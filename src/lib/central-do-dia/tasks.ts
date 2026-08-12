import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/supabase/types'
import type { DailyTaskItem, TaskBriefing } from './types'
import { compactCommercialSummary } from '@/lib/lead-summary'

type Client = SupabaseClient

function asBriefing(value: Json | null): TaskBriefing | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const contexto = value.contexto
  const abertura = value.abertura
  const objecao = value.objecao_provavel
  if (typeof contexto !== 'string' || typeof abertura !== 'string' || typeof objecao !== 'string') return null
  return { contexto, abertura, objecao_provavel: objecao }
}

export async function loadTaskQueue(
  supabase: Client,
  userId: string,
  isAdm: boolean,
  startIso: string,
  endExclusiveIso: string,
  startDate: string,
  endExclusiveDate: string,
) {
  let queueQuery = supabase
    .from('fila_diaria')
    .select('data, tarefa_id, posicao, faixa')
    .gte('data', startDate)
    .lt('data', endExclusiveDate)
  if (!isAdm) queueQuery = queueQuery.eq('responsavel_id', userId)

  let activeQuery = supabase
    .from('tarefas')
    .select('id,origem,vence_em')
    // Overdue follow-ups remain actionable until a call is registered. The
    // previous resgate exclusion made unfinished suggestions disappear after
    // fechar_fila_do_dia marked them as vencida.
    .in('status', ['pendente', 'vencida'])
  if (!isAdm) activeQuery = activeQuery.eq('responsavel_id', userId)

  let completedQuery = supabase
    .from('tarefas')
    .select('id')
    .eq('status', 'feita')
    .gte('concluida_em', startIso)
    .lt('concluida_em', endExclusiveIso)
  if (!isAdm) completedQuery = completedQuery.eq('responsavel_id', userId)

  const [queueResult, activeResult, completedResult] = await Promise.all([
    queueQuery,
    activeQuery,
    completedQuery,
  ])
  if (queueResult.error) throw queueResult.error
  if (activeResult.error) throw activeResult.error
  if (completedResult.error) throw completedResult.error

  const queueRows = queueResult.data
  const completedRows = completedResult.data
  const activeRows = (activeResult.data ?? []).filter(task =>
    task.origem === 'qualificacao' || new Date(task.vence_em).getTime() < new Date(endExclusiveIso).getTime()
  )

  const ids = Array.from(new Set([
    ...(queueRows ?? []).map(row => row.tarefa_id),
    ...(activeRows ?? []).map(row => row.id),
    ...(completedRows ?? []).map(row => row.id),
  ]))
  if (!ids.length) return []

  let tasksQuery = supabase
    .from('tarefas')
    .select('*')
    .in('id', ids)
    .neq('status', 'cancelada')
  if (!isAdm) tasksQuery = tasksQuery.eq('responsavel_id', userId)

  const { data: tasks, error } = await tasksQuery
  if (error) throw error
  if (!tasks?.length) return []

  const leadIds = Array.from(new Set(tasks.map(task => task.lead_id)))
  const taskIds = tasks.map(task => task.id)

  const [{ data: leads }, latestInteractionsResult, { data: calls }] = await Promise.all([
    supabase.from('leads').select('id,name,phone,city,stage,intention,imovel_interesse,summary,summary_comercial_curto,interaction_count,qualificado_em,primeira_ligacao_em,ultimo_contato_em,tentativas_ligacao,lead_score,aceitou_consultor,created_at').in('id', leadIds),
    supabase.rpc('central_ultimas_interacoes', { p_lead_ids: leadIds }),
    supabase.from('ligacoes').select('id,tarefa_id,desfecho,registrada_em,observacao,marcou_reuniao,retorno_em').in('tarefa_id', taskIds).is('excluida_em', null).order('registrada_em', { ascending: false }),
  ])
  if (latestInteractionsResult.error) throw latestInteractionsResult.error
  const recentInteractions = latestInteractionsResult.data

  const leadMap = new Map((leads ?? []).map(lead => [lead.id, lead]))
  const latestInteractionMap = new Map<string, string>()
  for (const interaction of recentInteractions ?? []) {
    if (!latestInteractionMap.has(interaction.lead_id)) {
      latestInteractionMap.set(interaction.lead_id, interaction.created_at)
    }
  }
  const callMap = new Map<string, NonNullable<typeof calls>[number]>()
  for (const call of calls ?? []) {
    if (call.tarefa_id && !callMap.has(call.tarefa_id)) callMap.set(call.tarefa_id, call)
  }
  const queueMap = new Map((queueRows ?? []).map(row => [row.tarefa_id, row]))

  return tasks.flatMap((task): DailyTaskItem[] => {
    const lead = leadMap.get(task.lead_id)
    if (!lead) return []

    // Pending work must always reflect the lead's current Kanban position.
    // Completed rows remain visible for the daily audit even if the outcome
    // moved the lead to another stage.
    if (task.status !== 'feita') {
      const isCurrentQualification = task.origem !== 'qualificacao'
        || (lead.stage === 'lead_quente' && !lead.primeira_ligacao_em)
      const isCurrentSuggestion = task.origem !== 'resgate'
        || (['lead_morno', 'lead_quente'].includes(lead.stage) && !lead.primeira_ligacao_em)
      const isCurrentRetry = task.origem !== 'retentativa' || lead.stage === 'lead_quente'
      const isCurrentConversationFollowup = task.origem !== 'acompanhamento' || lead.stage === 'lead_quente'
      if (!isCurrentQualification || !isCurrentSuggestion || !isCurrentRetry || !isCurrentConversationFollowup) return []
    }

    const queue = queueMap.get(task.id)
    const call = callMap.get(task.id)
    return [{
      id: task.id,
      leadId: lead.id,
      leadName: lead.name,
      stage: lead.stage,
      phone: lead.phone,
      summary: compactCommercialSummary({
        summary: lead.summary,
        shortSummary: lead.summary_comercial_curto,
        city: lead.city,
        intention: lead.intention,
        propertyInterest: lead.imovel_interesse,
        acceptedConsultant: lead.aceitou_consultor,
      }),
      score: Math.max(0, Math.min(10, (lead.lead_score ?? 0) / 10)),
      interactionCount: lead.interaction_count ?? 0,
      qualifiedAt: lead.qualificado_em,
      firstCallAt: lead.primeira_ligacao_em,
      lastContactAt: lead.ultimo_contato_em,
      noContactSince: task.origem === 'qualificacao' && lead.qualificado_em
        ? lead.qualificado_em
        : lead.ultimo_contato_em
          ?? latestInteractionMap.get(lead.id)
          ?? lead.qualificado_em
          ?? lead.created_at,
      attempts: lead.tentativas_ligacao,
      ownerId: task.responsavel_id,
      origin: task.origem,
      attemptNumber: task.tentativa_num,
      createdAt: task.criada_em,
      dueAt: task.vence_em,
      completedAt: task.concluida_em,
      status: task.status,
      note: task.observacao,
      briefing: asBriefing(task.briefing),
      queueDate: queue?.data ?? null,
      queuePosition: queue?.posicao ?? null,
      tier: queue?.faixa ?? null,
      call: call ? {
        id: call.id,
        outcome: call.desfecho,
        registeredAt: call.registrada_em,
        note: call.observacao,
        meetingScheduled: call.marcou_reuniao,
        returnAt: call.retorno_em,
      } : null,
    }]
  }).sort((a, b) => {
    const priority = (item: DailyTaskItem) => {
      if (item.status === 'vencida') return 0
      if (item.status === 'feita') return 6
      if (item.origin === 'retorno_agendado') return 1
      if (item.origin === 'qualificacao') return 2
      if (item.origin === 'retentativa') return 3
      if (item.origin === 'acompanhamento') return 4
      return 5
    }
    const statusA = priority(a)
    const statusB = priority(b)
    if (statusA !== statusB) return statusA - statusB
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  })
}
