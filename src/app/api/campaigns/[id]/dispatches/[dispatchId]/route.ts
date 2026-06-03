import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dispatchId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: campaignId, dispatchId } = await params
  const body = await req.json() as { message?: string }
  const { message } = body

  if (typeof message !== 'string') {
    return NextResponse.json({ error: 'message obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verificar que dispatch pertence a esta campanha
  const { data: dispatch } = await service
    .from('dispatches')
    .select('id, status')
    .eq('id', dispatchId)
    .eq('campaign_id', campaignId)
    .single()

  if (!dispatch) return NextResponse.json({ error: 'Dispatch não encontrado' }, { status: 404 })

  const { error } = await service
    .from('dispatches')
    .update({ message_sent: message.trim() } as never)
    .eq('id', dispatchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
