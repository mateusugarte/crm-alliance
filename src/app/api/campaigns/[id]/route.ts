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
    supabase.from('campaigns').select('*').eq('id', id).single(),
    supabase.from('dispatches').select('*').eq('campaign_id', id).order('created_at'),
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
  if (body.name !== undefined)                update.name                 = body.name.trim()
  if (body.interval_min !== undefined)         update.interval_min         = body.interval_min
  if (body.interval_max !== undefined)         update.interval_max         = body.interval_max
  if (body.allowed_hours_start !== undefined)  update.allowed_hours_start  = body.allowed_hours_start
  if (body.allowed_hours_end !== undefined)    update.allowed_hours_end    = body.allowed_hours_end

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('campaigns').update(update as never).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()

  // Dispatches are deleted by CASCADE on the DB, but we delete explicitly for clarity
  await service.from('dispatches').delete().eq('campaign_id', id)
  const { error } = await service.from('campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
