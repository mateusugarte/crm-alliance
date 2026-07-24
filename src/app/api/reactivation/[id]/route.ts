import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const [{ data: campaign, error: campErr }, { data: dispatches }] = await Promise.all([
    supabase.from('reactivation_campaigns').select('*').eq('id', id).single(),
    supabase.from('reactivation_dispatches').select('*').eq('reactivation_campaign_id', id).order('created_at'),
  ])

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  }

  const c = campaign as Record<string, unknown>
  return NextResponse.json({ ...c, dispatches: dispatches ?? [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    name?: string
    interval_min?: number
    interval_max?: number
    allowed_hours_start?: number
    allowed_hours_end?: number
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)               update.name                = body.name.trim()
  if (body.interval_min !== undefined)        update.interval_min        = body.interval_min
  if (body.interval_max !== undefined)        update.interval_max        = body.interval_max
  if (body.allowed_hours_start !== undefined) update.allowed_hours_start = body.allowed_hours_start
  if (body.allowed_hours_end !== undefined)   update.allowed_hours_end   = body.allowed_hours_end

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('reactivation_campaigns').update(update as never).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Intervalo mudou: os pendentes já tinham scheduled_at calculado com o intervalo antigo.
  // Limpa pra o motor recalcular com o novo intervalo assim que retomar.
  if (body.interval_min !== undefined || body.interval_max !== undefined) {
    await service
      .from('reactivation_dispatches')
      .update({ scheduled_at: null, interval_delay_ms: null } as never)
      .eq('reactivation_campaign_id', id)
      .eq('status', 'pending')
  }

  return NextResponse.json({ ok: true })
}
