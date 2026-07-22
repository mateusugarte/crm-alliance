import { NextRequest, NextResponse } from 'next/server'
import { runAliceAgent, ALICE_FALLBACK_REPLY } from '@/lib/ai/alice-agent'
import { toWhatsAppNumber } from '@/lib/format-phone'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'

type Lead = Database['public']['Tables']['leads']['Row']
type LeadInsert = Database['public']['Tables']['leads']['Insert']
type LeadUpdate = Database['public']['Tables']['leads']['Update']
type InteractionInsert = Database['public']['Tables']['interactions']['Insert']
type Interaction = Database['public']['Tables']['interactions']['Row']

const VALID_STAGES: Lead['stage'][] = [
  'nao_respondeu',
  'lead_frio',
  'lead_morno',
  'lead_quente',
  'follow_up',
  'reuniao_agendada',
  'visita_confirmada',
  'cliente',
]

interface N8NAgentPayload {
  lead_id?: string
  phone?: string
  numero_limpo?: string
  remoteJid?: string
  wa_contact_id?: string
  pushName?: string
  name?: string
  message?: string
  conversation?: string
  wa_message_id?: string
  message_id?: string
  reactivation?: boolean
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function phoneCandidates(raw: string) {
  const digits = toWhatsAppNumber(raw)
  const candidates = new Set<string>()

  if (raw.trim()) candidates.add(raw.trim())
  if (digits) {
    candidates.add(digits)
    candidates.add(`${digits}@s.whatsapp.net`)
    if (digits.startsWith('55') && digits.length > 2) {
      candidates.add(`55 ${digits.slice(2)}`)
    }
  }

  return { digits, candidates: [...candidates] }
}

async function findOrCreateLead(
  supabase: ReturnType<typeof createServiceClient>,
  payload: N8NAgentPayload
): Promise<Lead | null> {
  if (payload.lead_id) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', payload.lead_id)
      .maybeSingle()

    if (error) throw error
    if (data) return data as Lead
  }

  const rawPhone = payload.phone ?? payload.numero_limpo ?? payload.remoteJid ?? ''
  const { digits, candidates } = phoneCandidates(rawPhone)

  if (!digits) return null

  const { data: existing, error: existingError } = await supabase
    .from('leads')
    .select('*')
    .in('phone', candidates)
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing as Lead

  const insert: LeadInsert = {
    name: payload.name?.trim() || payload.pushName?.trim() || digits,
    phone: `${digits}@s.whatsapp.net`,
    wa_contact_id: payload.wa_contact_id ?? payload.remoteJid ?? null,
    stage: 'lead_frio',
    automation_paused: false,
  }

  const { data: created, error: createError } = await supabase
    .from('leads')
    .insert(insert as never)
    .select('*')
    .single()

  if (createError) throw createError
  return created as Lead
}

function buildLeadUpdates(lead: Lead, output: Awaited<ReturnType<typeof runAliceAgent>>) {
  const updates: LeadUpdate = { updated_at: new Date().toISOString() }
  const leadUpdates = output.lead_updates ?? {}

  if (typeof leadUpdates.name === 'string' && leadUpdates.name.trim()) {
    updates.name = leadUpdates.name.trim()
  }
  if (typeof leadUpdates.city === 'string') {
    updates.city = leadUpdates.city.trim() || null
  }
  if (leadUpdates.intention === 'morar' || leadUpdates.intention === 'investir') {
    updates.intention = leadUpdates.intention
  }
  if (typeof leadUpdates.imovel_interesse === 'string') {
    updates.imovel_interesse = leadUpdates.imovel_interesse.trim() || null
  }
  if (leadUpdates.stage && VALID_STAGES.includes(leadUpdates.stage)) {
    updates.stage = leadUpdates.stage
  }
  if (typeof leadUpdates.summary === 'string') {
    updates.summary = leadUpdates.summary.trim() || null
  } else if (output.actions.includes('qualificado') && output.internal_summary) {
    updates.summary = output.internal_summary
  }

  if (typeof leadUpdates.automation_paused === 'boolean') {
    updates.automation_paused = leadUpdates.automation_paused
  }
  if (typeof leadUpdates.aceitou_consultor === 'boolean') {
    updates.aceitou_consultor = leadUpdates.aceitou_consultor
  }
  if (typeof leadUpdates.pdf_enviado === 'boolean') {
    updates.pdf_enviado = leadUpdates.pdf_enviado
  }

  if (output.actions.includes('pausar_IA') || output.actions.includes('stop')) {
    updates.automation_paused = true
  }
  if (output.actions.includes('aceitou_ligacao')) {
    updates.aceitou_consultor = true
  }
  if (output.actions.includes('qualificado') && !updates.stage) {
    updates.stage = lead.stage === 'lead_frio' || lead.stage === 'nao_respondeu'
      ? 'lead_quente'
      : lead.stage
  }

  return updates
}

export async function POST(request: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET
  const incomingSecret = request.headers.get('x-webhook-secret')

  if (!secret || incomingSecret !== secret) {
    return unauthorized()
  }

  const payload = await request.json() as N8NAgentPayload
  const message = (payload.message ?? payload.conversation ?? '').trim()
  const reactivation = payload.reactivation === true || (payload.reactivation as unknown) === 'true'

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const lead = await findOrCreateLead(supabase, payload)
    if (!lead) {
      return NextResponse.json({ error: 'lead_id or valid phone is required' }, { status: 400 })
    }

    const waMessageId = payload.wa_message_id ?? payload.message_id ?? null

    // Reactivation is a manual recontact: the message is context for Alice (either a lead
    // message that never got answered, or an internal cue), not a fresh inbound event to log/dedupe.
    if (!reactivation) {
      if (waMessageId) {
        const { data: existingInteraction, error: duplicateError } = await supabase
          .from('interactions')
          .select('id')
          .eq('wa_message_id', waMessageId)
          .maybeSingle()

        if (duplicateError) throw duplicateError
        if (existingInteraction) {
          return NextResponse.json({
            data: {
              lead_id: lead.id,
              duplicate: true,
              reply: null,
              actions: [],
            },
          })
        }
      }

      const inbound: InteractionInsert = {
        lead_id: lead.id,
        direction: 'inbound',
        sender_type: 'lead',
        sender_name: lead.name,
        content: message,
        wa_message_id: waMessageId,
      }

      const { error: inboundError } = await supabase
        .from('interactions')
        .insert(inbound as never)

      if (inboundError) throw inboundError
      await supabase.rpc('increment_interaction_count', { lead_uuid: lead.id } as never)
    }

    if (lead.automation_paused) {
      return NextResponse.json({
        data: {
          lead_id: lead.id,
          skipped: 'automation_paused',
          reply: null,
          actions: [],
        },
      })
    }

    const { data: historyData, error: historyError } = await supabase
      .from('interactions')
      .select('direction, sender_type, sender_name, content, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(60)

    if (historyError) {
      console.error('[n8n-agent/run] failed to load history, continuing without it', historyError)
    }

    const { data: imoveisData, error: imoveisError } = await supabase
      .from('imoveis')
      .select('*')
      .eq('disponivel', true)
      .eq('vendido', false)
      .order('pavimento', { ascending: true })
      .order('numero_unidade', { ascending: true })

    if (imoveisError) {
      console.error('[n8n-agent/run] failed to load imoveis, continuing without them', imoveisError)
    }

    let output: Awaited<ReturnType<typeof runAliceAgent>>
    try {
      output = await runAliceAgent({
        lead,
        message,
        history: ((historyData ?? []) as Interaction[]).reverse(),
        imoveis: imoveisData ?? [],
        nowIso: new Date().toISOString(),
        reactivation,
      })
    } catch (agentError) {
      console.error('[n8n-agent/run] Alice agent failed, falling back to safe reply', agentError)
      output = {
        reply: ALICE_FALLBACK_REPLY,
        actions: [],
        lead_updates: {},
        send_pdf: !lead.pdf_enviado,
      }
    }

    const updates = buildLeadUpdates(lead, output)
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates as never)
      .eq('id', lead.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('[n8n-agent/run] failed to persist lead updates, reply still goes out', updateError)
    }

    if (output.reply) {
      const outbound: InteractionInsert = {
        lead_id: lead.id,
        direction: 'outbound',
        sender_type: 'bot',
        sender_name: 'Alice',
        content: output.reply,
      }

      const { error: outboundError } = await supabase
        .from('interactions')
        .insert(outbound as never)

      if (outboundError) {
        console.error('[n8n-agent/run] failed to log outbound interaction, reply still goes out', outboundError)
      }
    }

    return NextResponse.json({
      data: {
        lead_id: lead.id,
        reply: output.reply,
        send_pdf: output.send_pdf ?? false,
        actions: output.actions,
        lead_updates: updates,
        lead: updatedLead ?? lead,
        internal_summary: output.internal_summary,
      },
    })
  } catch (error) {
    console.error('[n8n-agent/run]', error)
    const message = error instanceof Error ? error.message : 'Erro ao executar agente'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
