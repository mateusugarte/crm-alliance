import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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
  for (const dispatch of dispatches) {
    // Match by lead_id first, then by phone
    const dispatchPhoneNorm = dispatch.phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const match = (dispatch.lead_id ? byLeadId.get(dispatch.lead_id) : undefined) ?? byPhone.get(dispatchPhoneNorm)
    if (!match) continue

    await service
      .from('reactivation_dispatches')
      .update({
        message_sent:      match.message,
        typing_delay:      match.typing_delay ?? getTypingDelay(),
        interval_delay_ms: match.interval_delay_ms ?? getIntervalDelayMs(campaign.interval_min, campaign.interval_max),
      } as never)
      .eq('id', dispatch.id)

    updated++
  }

  return NextResponse.json({ updated, total: dispatches.length })
}
