import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCallRegistration } from '@/lib/central-do-dia/call-registration'
import type { TaskCompletionResult } from '@/lib/central-do-dia/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseCallRegistration(await request.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data

  const { data, error } = await supabase.rpc('registrar_ligacao_v2', {
    p_tarefa_id: id,
    p_desfecho: body.outcome,
    p_observacao: body.note,
    p_retorno_em: body.returnAt,
    p_marcou_reuniao: body.meetingScheduled,
    p_motivo_perda: body.lossReason,
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
