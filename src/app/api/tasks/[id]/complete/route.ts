import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TaskCompletionResult, TaskOutcome } from '@/lib/central-do-dia/types'

const OUTCOMES: TaskOutcome[] = [
  'atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado', 'pediu_retorno', 'sem_interesse',
]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    outcome?: TaskOutcome
    note?: string
    returnAt?: string | null
    meetingScheduled?: boolean
    lossReason?: string | null
  }

  if (!body.outcome || !OUTCOMES.includes(body.outcome)) {
    return NextResponse.json({ error: 'Desfecho invalido' }, { status: 400 })
  }
  if (body.outcome === 'pediu_retorno' && !body.returnAt) {
    return NextResponse.json({ error: 'Informe a data de retorno' }, { status: 400 })
  }
  if (body.outcome === 'atendeu' && !body.note?.trim()) {
    return NextResponse.json({ error: 'Informe o que foi conversado' }, { status: 400 })
  }
  if (body.outcome === 'sem_interesse' && !body.lossReason?.trim()) {
    return NextResponse.json({ error: 'Informe o motivo da perda' }, { status: 400 })
  }
  const { data, error } = await supabase.rpc('registrar_ligacao_v2', {
    p_tarefa_id: id,
    p_desfecho: body.outcome,
    p_observacao: body.note?.trim() || null,
    p_retorno_em: body.returnAt || null,
    p_marcou_reuniao: body.meetingScheduled ?? false,
    p_motivo_perda: body.lossReason?.trim() || null,
  } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data as unknown as TaskCompletionResult })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const callId = request.nextUrl.searchParams.get('callId')
  if (!callId) return NextResponse.json({ error: 'callId obrigatorio' }, { status: 400 })

  const { data, error } = await supabase.rpc('desfazer_ligacao_v2', { p_ligacao_id: callId } as never)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data as unknown as TaskCompletionResult })
}
