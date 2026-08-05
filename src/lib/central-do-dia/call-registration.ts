import type { TaskOutcome } from './types'

export const CALL_OUTCOMES: TaskOutcome[] = [
  'atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado', 'pediu_retorno', 'sem_interesse',
]

export interface CallRegistrationInput {
  outcome: TaskOutcome
  note: string | null
  returnAt: string | null
  meetingScheduled: boolean
  lossReason: string | null
}

export function parseCallRegistration(input: unknown):
  | { ok: true; data: CallRegistrationInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Dados da ligação inválidos' }

  const body = input as Record<string, unknown>
  if (typeof body.outcome !== 'string' || !CALL_OUTCOMES.includes(body.outcome as TaskOutcome)) {
    return { ok: false, error: 'Desfecho inválido' }
  }

  const outcome = body.outcome as TaskOutcome
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const lossReason = typeof body.lossReason === 'string' ? body.lossReason.trim() : ''
  const returnAt = typeof body.returnAt === 'string' && body.returnAt ? body.returnAt : null

  if (note.length > 4_000 || lossReason.length > 500) return { ok: false, error: 'O registro da ligação está muito longo' }
  if (outcome === 'atendeu' && !note) return { ok: false, error: 'Informe o que foi conversado' }
  if (outcome === 'pediu_retorno' && (!returnAt || Number.isNaN(new Date(returnAt).getTime()))) {
    return { ok: false, error: 'Informe uma data de retorno válida' }
  }
  if (outcome === 'sem_interesse' && !lossReason) return { ok: false, error: 'Informe o motivo da perda' }

  return {
    ok: true,
    data: {
      outcome,
      note: note || null,
      returnAt: outcome === 'pediu_retorno' ? returnAt : null,
      meetingScheduled: outcome === 'atendeu' && body.meetingScheduled === true,
      lossReason: outcome === 'sem_interesse' ? lossReason : null,
    },
  }
}
