import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordDispatchToMemory } from '@/lib/pg-memory'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dispatchId: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: campaignId, dispatchId } = await params
  const body = await req.json() as { message?: string }

  if (typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: dispatch } = await service
    .from('dispatches')
    .select('id, status, phone')
    .eq('id', dispatchId)
    .eq('campaign_id', campaignId)
    .single()

  if (!dispatch) {
    return NextResponse.json({ error: 'Dispatch não encontrado' }, { status: 404 })
  }

  const { error } = await service
    .from('dispatches')
    .update({ message_sent: body.message.trim() } as never)
    .eq('id', dispatchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await recordDispatchToMemory((dispatch as { phone: string }).phone, body.message.trim())
  } catch { /* não bloquear se a memória falhar */ }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dispatchId: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: campaignId, dispatchId } = await params
  const service = createServiceClient()

  const { data: dispatch } = await service
    .from('dispatches')
    .select('id, status')
    .eq('id', dispatchId)
    .eq('campaign_id', campaignId)
    .single()

  if (!dispatch) return NextResponse.json({ error: 'Dispatch não encontrado' }, { status: 404 })
  if ((dispatch as { status: string }).status !== 'pending') {
    return NextResponse.json({ error: 'Só é possível remover dispatches pendentes' }, { status: 422 })
  }

  const { error } = await service.from('dispatches').delete().eq('id', dispatchId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrement total_leads (manual update, no RPC needed)
  const { data: camp } = await service.from('campaigns').select('total_leads').eq('id', campaignId).single()
  if (camp) {
    await service.from('campaigns').update({ total_leads: Math.max(0, (camp as { total_leads: number }).total_leads - 1) } as never).eq('id', campaignId)
  }

  return NextResponse.json({ ok: true })
}
