import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordDispatchToMemory } from '@/lib/pg-memory'
import type { Json } from '@/lib/supabase/types'
import { hasBlocker, inspectMessage } from '@/lib/disparo/message-quality'
import type { CampaignBrief } from '@/lib/disparo/campaign-brief'
import type { CommercialFact, ContextMode } from '@/lib/disparo/lead-brief'
import type { MessagePlan } from '@/lib/disparo/message-plan'

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function getTypingDelay() {
  return randomBetween(2000, 3800)
}

function getIntervalDelayMs(intervalMin: number, intervalMax: number) {
  const minutes = randomBetween(intervalMin, intervalMax)
  const seconds = Math.floor(Math.random() * 60)
  const ms      = Math.floor(Math.random() * 1000)
  return minutes * 60 * 1000 + seconds * 1000 + ms
}

interface InjectMessage {
  lead_id?: string | null
  phone?: string | null
  message: string
  interval_delay_ms?: number | null
  typing_delay?: number | null
  generation?: {
    original_message: string
    approved_message: string
    campaign_brief: CampaignBrief
    audience: Json
    context_facts: CommercialFact[]
    message_plan: MessagePlan
    context_mode: ContextMode
    context_summary: string
    safe_name: string | null
    model: string | null
    prompt_version: string
    resolution: string
    quality_flags: string[]
    manually_edited: boolean
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id: campaignId } = await params
  const body = await req.json() as { messages?: InjectMessage[] }
  const { messages } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages obrigatório' }, { status: 400 })
  }
  const invalidSnapshot = messages.find(message => message.generation && (
    !message.generation.original_message
    || !message.generation.campaign_brief
    || !message.generation.audience
    || !message.generation.message_plan
    || !message.generation.context_mode
    || !message.generation.context_summary
    || !message.generation.prompt_version
    || !message.generation.resolution
  ))
  if (invalidSnapshot) {
    return NextResponse.json({ error: 'Metadados de auditoria da mensagem estão incompletos' }, { status: 400 })
  }

  const unsafeEdit = messages.find(message => {
    const generation = message.generation
    if (!generation) return false
    const grounding = [
      ...generation.campaign_brief.current_facts.map(fact => fact.value),
      ...generation.context_facts.filter(fact => fact.safe_for_copy).map(fact => fact.value),
    ].join('\n')
    return hasBlocker(inspectMessage(
      message.message,
      generation.context_mode,
      generation.safe_name,
      generation.campaign_brief.normalized_theme,
      grounding,
    ))
  })
  if (unsafeEdit) {
    return NextResponse.json({
      error: 'Uma mensagem editada contém informação sem fonte ou conteúdo bloqueado. Revise a prévia antes de continuar.',
      lead_id: unsafeEdit.lead_id ?? null,
    }, { status: 422 })
  }

  const service = createServiceClient()

  const { data: campaignRaw } = await service
    .from('reactivation_campaigns')
    .select('id, interval_min, interval_max')
    .eq('id', campaignId)
    .single()

  const campaign = campaignRaw as { id: string; interval_min: number; interval_max: number } | null
  if (!campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  }

  const { data: dispatchesRaw } = await service
    .from('reactivation_dispatches')
    .select('id, lead_id, phone')
    .eq('reactivation_campaign_id', campaignId)
    .eq('status', 'pending')

  const dispatches = (dispatchesRaw ?? []) as { id: string; lead_id: string | null; phone: string }[]
  if (!dispatches.length) {
    return NextResponse.json({ error: 'Nenhum dispatch pendente encontrado' }, { status: 404 })
  }

  // Build lookup maps: by lead_id and by phone (normalized, strip @s.whatsapp.net)
  const byLeadId = new Map<string, InjectMessage>()
  const byPhone  = new Map<string, InjectMessage>()

  for (const m of messages) {
    if (m.lead_id) byLeadId.set(m.lead_id, m)
    if (m.phone) {
      const normalized = m.phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
      byPhone.set(normalized, m)
    }
  }

  let updated = 0
  const failures: string[] = []
  for (const dispatch of dispatches) {
    // Match by lead_id first, then by phone
    const dispatchPhoneNorm = dispatch.phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const match = (dispatch.lead_id ? byLeadId.get(dispatch.lead_id) : undefined) ?? byPhone.get(dispatchPhoneNorm)
    if (!match) continue

    const { data: injected, error: injectError } = await service.rpc('inject_reactivation_message', {
      p_dispatch_id: dispatch.id,
      p_message: match.message,
      p_typing_delay: match.typing_delay ?? getTypingDelay(),
      p_interval_delay_ms: match.interval_delay_ms ?? getIntervalDelayMs(campaign.interval_min, campaign.interval_max),
      p_snapshot: match.generation ? match.generation as unknown as Json : null,
      p_approved_by: user.id,
    } as never)
    if (injectError || !injected) {
      failures.push(dispatch.id)
      continue
    }

    try {
      await recordDispatchToMemory(dispatch.phone, match.message)
    } catch { /* não bloquear o disparo se a memória falhar */ }

    updated++
  }

  if (failures.length) {
    return NextResponse.json({
      error: `Falha ao configurar ${failures.length} mensagem(ns). Nenhum disparo foi iniciado.`,
      updated,
      failed_dispatch_ids: failures,
    }, { status: 500 })
  }

  return NextResponse.json({ updated, total: dispatches.length })
}
