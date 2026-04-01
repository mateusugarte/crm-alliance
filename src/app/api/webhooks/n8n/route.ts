import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

interface N8NInteraction {
  direction: 'inbound' | 'outbound'
  content: string
  wa_message_id?: string
}

interface N8NPayload {
  lead_id: string
  stage?: string
  summary?: string
  interaction?: N8NInteraction
}

export async function POST(request: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET
  const incomingSecret = request.headers.get('x-webhook-secret')

  if (secret && incomingSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as N8NPayload

  if (!body.lead_id) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  }

  // SERVICE_ROLE_KEY — bypassa RLS para operações do n8n
  const supabase = createServiceClient()

  // ── Atualiza o lead (stage, summary, updated_at) ──────────────────────────
  const updates: LeadUpdate = { updated_at: new Date().toISOString() }
  if (body.stage) updates['stage'] = body.stage as LeadUpdate['stage']
  if (body.summary) updates['summary'] = body.summary

  const { error: leadError } = await supabase
    .from('leads')
    .update(updates as never)
    .eq('id', body.lead_id)

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  // ── Insere interação se enviada ───────────────────────────────────────────
  if (body.interaction) {
    const { direction, content, wa_message_id } = body.interaction

    if (!direction || !content?.trim()) {
      return NextResponse.json(
        { error: 'interaction.direction e interaction.content são obrigatórios' },
        { status: 400 }
      )
    }

    // Evita duplicata pelo wa_message_id (deduplicação)
    if (wa_message_id) {
      const { data: existing } = await supabase
        .from('interactions')
        .select('id')
        .eq('wa_message_id', wa_message_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: { updated: true, interaction: 'duplicate_skipped' } })
      }
    }

    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({
        lead_id: body.lead_id,
        direction,
        content: content.trim(),
        wa_message_id: wa_message_id ?? null,
      } as never)

    if (interactionError) {
      return NextResponse.json({ error: interactionError.message }, { status: 500 })
    }

    // Incrementa interaction_count apenas para mensagens inbound
    if (direction === 'inbound') {
      await supabase.rpc('increment_interaction_count', { lead_uuid: body.lead_id })
        .then(({ error }) => {
          if (error) {
            // Fallback manual se a função RPC não existir
            supabase
              .from('leads')
              .select('interaction_count')
              .eq('id', body.lead_id)
              .single()
              .then(({ data }) => {
                if (data) {
                  supabase
                    .from('leads')
                    .update({ interaction_count: (data.interaction_count ?? 0) + 1 } as never)
                    .eq('id', body.lead_id)
                }
              })
          }
        })
    }
  }

  return NextResponse.json({ data: { updated: true } })
}
