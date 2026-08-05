import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCallRegistration } from '@/lib/central-do-dia/call-registration'
import type { TaskCompletionResult } from '@/lib/central-do-dia/types'
import type { TaskOutcome } from '@/lib/central-do-dia/types'

export interface LeadCall {
  id: string
  outcome: TaskOutcome
  registeredAt: string
  note: string | null
  meetingScheduled: boolean
  meetingAt: string | null
  returnAt: string | null
  ownerName: string
}

type LigacaoRow = {
  id: string
  desfecho: TaskOutcome
  registrada_em: string
  observacao: string | null
  marcou_reuniao: boolean
  reuniao_em: string | null
  retorno_em: string | null
  user_profiles: { full_name: string | null } | null
}

/**
 * Histórico de ligações de um lead.
 *
 * A tabela `ligacoes` já era gravada pela Central do Dia, mas nada no CRM a
 * lia de volta — o corretor registrava a ligação e ela desaparecia. Esta rota
 * é o que faz o registro voltar para o painel do lead.
 *
 * Registros com `excluida_em` preenchido são exclusões lógicas (o "desfazer"
 * da fila) e ficam de fora.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('ligacoes')
    .select('id, desfecho, registrada_em, observacao, marcou_reuniao, reuniao_em, retorno_em, user_profiles!ligacoes_responsavel_id_fkey(full_name)')
    .eq('lead_id', id)
    .is('excluida_em', null)
    .order('registrada_em', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar as ligações' }, { status: 500 })
  }

  const calls: LeadCall[] = ((data ?? []) as unknown as LigacaoRow[]).map(row => ({
    id: row.id,
    outcome: row.desfecho,
    registeredAt: row.registrada_em,
    note: row.observacao,
    meetingScheduled: row.marcou_reuniao,
    meetingAt: row.reuniao_em,
    returnAt: row.retorno_em,
    ownerName: row.user_profiles?.full_name ?? 'Consultor',
  }))

  return NextResponse.json({ data: calls })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseCallRegistration(await request.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { id } = await params
  const body = parsed.data
  const { data, error } = await supabase.rpc('registrar_ligacao_lead_v1', {
    p_lead_id: id,
    p_desfecho: body.outcome,
    p_observacao: body.note,
    p_retorno_em: body.returnAt,
    p_marcou_reuniao: body.meetingScheduled,
    p_motivo_perda: body.lossReason,
  } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data as unknown as TaskCompletionResult })
}
