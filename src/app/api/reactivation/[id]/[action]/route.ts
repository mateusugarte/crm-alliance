import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { startReactivation, pauseReactivation, stopReactivation } from '@/lib/disparo/engine'

const VALID_ACTIONS = ['start', 'pause', 'stop'] as const
type Action = typeof VALID_ACTIONS[number]

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: campaignId, action } = await params

  if (!VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: campaign } = await service
    .from('reactivation_campaigns')
    .select('id, status, allowed_hours_start, allowed_hours_end')
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (action === 'start') {
    const c = campaign as { allowed_hours_start: number; allowed_hours_end: number }
    const nowHour = new Date().getHours()
    if (nowHour < c.allowed_hours_start || nowHour > c.allowed_hours_end) {
      return NextResponse.json({
        error: `Fora do horário permitido. Esta reativação só pode rodar entre ${c.allowed_hours_start}h e ${c.allowed_hours_end}h.`,
        allowed_hours_start: c.allowed_hours_start,
        allowed_hours_end: c.allowed_hours_end,
      }, { status: 422 })
    }

    const { count } = await service
      .from('reactivation_dispatches')
      .select('id', { count: 'exact', head: true })
      .eq('reactivation_campaign_id', campaignId)
      .eq('status', 'pending')
      .is('message_sent', null)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Existem contatos sem mensagem preparada. Execute o preparo antes de iniciar.' },
        { status: 400 },
      )
    }
  }

  if (action === 'start') await startReactivation(campaignId)
  else if (action === 'pause') await pauseReactivation(campaignId)
  else await stopReactivation(campaignId)

  const newStatus = action === 'start' ? 'running' : action === 'pause' ? 'paused' : 'cancelled'
  return NextResponse.json({ ok: true, status: newStatus })
}
