import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const STATUS_MAP: Record<string, string> = {
  start: 'running',
  pause: 'paused',
  stop:  'cancelled',
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: campaignId, action } = await params

  const newStatus = STATUS_MAP[action]
  if (!newStatus) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const service = createServiceClient()

  const { data: campaign } = await service
    .from('campaigns')
    .select('id, status, allowed_hours_start, allowed_hours_end')
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  // Validate allowed hours when starting
  if (action === 'start') {
    const c = campaign as { allowed_hours_start: number; allowed_hours_end: number }
    const nowHour = new Date().getHours()
    if (nowHour < c.allowed_hours_start || nowHour > c.allowed_hours_end) {
      return NextResponse.json({
        error: `Fora do horário permitido. Esta campanha só pode rodar entre ${c.allowed_hours_start}h e ${c.allowed_hours_end}h.`,
        allowed_hours_start: c.allowed_hours_start,
        allowed_hours_end: c.allowed_hours_end,
      }, { status: 422 })
    }
  }

  const { error } = await service
    .from('campaigns')
    .update({ status: newStatus } as never)
    .eq('id', campaignId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se o serviço externo estiver configurado, notificá-lo também
  const externalUrl = process.env.NEXT_PUBLIC_DISPARO_API_URL
  if (externalUrl) {
    try {
      await fetch(`${externalUrl}/api/campaigns/${campaignId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch { /* não bloquear se o serviço externo falhar */ }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
