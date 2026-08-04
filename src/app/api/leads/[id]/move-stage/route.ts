import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'

const VALID_STAGES = ['nao_respondeu', 'lead_frio', 'lead_morno', 'lead_quente', 'follow_up', 'sem_interesse', 'reuniao_agendada', 'visita_confirmada', 'cliente'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { stage?: string; motivo_perda?: string | null }

  if (!body.stage || !VALID_STAGES.includes(body.stage as typeof VALID_STAGES[number])) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  if (body.stage === 'sem_interesse' && !body.motivo_perda?.trim()) {
    return NextResponse.json({ error: 'Motivo de perda obrigatorio' }, { status: 400 })
  }

  const { error } = await supabase
    .rpc('move_lead_stage_context', {
      lead_uuid: id,
      new_stage: body.stage,
      p_motivo_perda: body.motivo_perda?.trim() || null,
      p_origem: 'kanban',
    } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.stage === 'lead_quente') {
    try {
      await deliverPendingGroupMessages(5)
    } catch (deliveryError) {
      console.error('[move-stage] failed to deliver qualification alert', deliveryError)
    }
  }

  return NextResponse.json({ data: { id, stage: body.stage } })
}
