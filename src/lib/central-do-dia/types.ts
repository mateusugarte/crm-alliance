export type TaskOutcome =
  | 'atendeu'
  | 'nao_atendeu'
  | 'caixa_postal'
  | 'numero_errado'
  | 'pediu_retorno'
  | 'sem_interesse'

export interface TaskBriefing {
  contexto: string
  abertura: string
  objecao_provavel: string
}

export interface DailyTaskItem {
  id: string
  leadId: string
  leadName: string
  stage: string
  phone: string
  summary: string | null
  score: number
  interactionCount: number
  qualifiedAt: string | null
  firstCallAt: string | null
  lastContactAt: string | null
  noContactSince: string
  attempts: number
  ownerId: string
  origin: 'qualificacao' | 'resgate' | 'retorno_agendado' | 'retentativa' | 'acompanhamento' | 'manual'
  attemptNumber: number
  createdAt: string
  dueAt: string
  completedAt: string | null
  status: 'pendente' | 'feita' | 'vencida' | 'cancelada'
  note: string | null
  briefing: TaskBriefing | null
  queueDate: string | null
  queuePosition: number | null
  tier: 'alta' | 'media' | 'longo_prazo' | null
  call: {
    id: string
    outcome: TaskOutcome
    registeredAt: string
    note: string | null
    meetingScheduled: boolean
    returnAt: string | null
  } | null
}

export interface TaskCompletionResult {
  call: NonNullable<DailyTaskItem['call']>
  task: { id: string; status: 'feita' | 'pendente'; completedAt: string | null }
  lead: {
    id: string
    stage: string
    attempts: number
    firstCallAt: string | null
    lastContactAt: string | null
    lastOutcome: TaskOutcome | null
    lossReason?: string | null
    dataNeedsCorrection?: boolean
  }
  nextTask: { id: string; origin: DailyTaskItem['origin']; dueAt: string } | null
}
