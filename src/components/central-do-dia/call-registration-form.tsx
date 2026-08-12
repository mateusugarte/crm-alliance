'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Ban, CalendarCheck, ICON, MessageCircle } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT } from '@/lib/animations'
import { LOSS_REASONS, OUTCOMES } from '@/lib/central-do-dia/outcomes'
import { stageTokens } from '@/lib/stages'
import type { CallRegistrationInput } from '@/lib/central-do-dia/call-registration'
import type { TaskOutcome } from '@/lib/central-do-dia/types'

function fieldClass(extra?: string) {
  return cn(
    'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-ui',
    'placeholder:text-ink-subtle focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/25',
    extra,
  )
}

type AnsweredResult = 'em_conversa' | 'reuniao' | 'sem_interesse'

const ANSWERED_RESULTS = [
  { value: 'em_conversa', label: 'Em conversa', icon: MessageCircle, tone: stageTokens('lead_quente') },
  { value: 'reuniao', label: 'Reunião marcada', icon: CalendarCheck, tone: stageTokens('reuniao_agendada') },
  { value: 'sem_interesse', label: 'Sem interesse', icon: Ban, tone: stageTokens('sem_interesse') },
] satisfies Array<{
  value: AnsweredResult
  label: string
  icon: typeof MessageCircle
  tone: ReturnType<typeof stageTokens>
}>

const PRIMARY_OUTCOMES = OUTCOMES.filter(item => item.value !== 'sem_interesse')

export function CallRegistrationForm({ onSubmit, onCancel, compact = false }: {
  onSubmit: (input: CallRegistrationInput) => Promise<void>
  onCancel: () => void
  compact?: boolean
}) {
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null)
  const [answeredResult, setAnsweredResult] = useState<AnsweredResult | null>(null)
  const [note, setNote] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [lossReason, setLossReason] = useState('')
  const [lossDetail, setLossDetail] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!outcome) return toast.error('Escolha como foi a ligação')
    if (outcome === 'atendeu' && !answeredResult) return toast.error('Informe como ficou o atendimento')
    if (outcome === 'pediu_retorno' && !returnAt) return toast.error('Informe quando retornar')
    if (outcome === 'atendeu' && answeredResult === 'sem_interesse' && !lossReason) {
      return toast.error('Informe o motivo da perda')
    }

    const resolvedOutcome: TaskOutcome = outcome === 'atendeu' && answeredResult === 'sem_interesse'
      ? 'sem_interesse'
      : outcome

    setSaving(true)
    try {
      await onSubmit({
        outcome: resolvedOutcome,
        note: note.trim() || null,
        returnAt: returnAt ? new Date(returnAt).toISOString() : null,
        meetingScheduled: outcome === 'atendeu' && answeredResult === 'reuniao',
        lossReason: resolvedOutcome === 'sem_interesse'
          ? [lossReason, lossDetail.trim()].filter(Boolean).join(': ')
          : null,
      })
      toast.success('Ligação registrada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar ligação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface', compact ? 'p-3' : 'p-4')}>
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-ink">Como foi a ligação?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRIMARY_OUTCOMES.map(item => {
            const Icon = item.icon
            const active = outcome === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setOutcome(item.value)
                  setAnsweredResult(null)
                  setLossReason('')
                  setLossDetail('')
                }}
                aria-pressed={active}
                style={active ? { backgroundColor: item.tone.soft, borderColor: item.tone.solid, color: item.tone.ink } : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-ui',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !active && 'border-line-strong bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <Icon size={ICON.xs} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {outcome && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              {outcome === 'atendeu' && (
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-ink-muted">Como ficou o atendimento?</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {ANSWERED_RESULTS.map(item => {
                      const Icon = item.icon
                      const active = answeredResult === item.value
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setAnsweredResult(item.value)}
                          aria-pressed={active}
                          style={active ? {
                            backgroundColor: item.tone.soft,
                            borderColor: item.tone.solid,
                            color: item.tone.ink,
                          } : undefined}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-ui',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !active && 'border-line-strong bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink',
                          )}
                        >
                          <Icon size={ICON.xs} className="flex-shrink-0" />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              {outcome === 'pediu_retorno' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">Retornar em</span>
                  <input type="datetime-local" value={returnAt} onChange={event => setReturnAt(event.target.value)} className={fieldClass()} />
                </label>
              )}

              {outcome === 'atendeu' && answeredResult === 'sem_interesse' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">Motivo da perda</span>
                    <select value={lossReason} onChange={event => setLossReason(event.target.value)} className={fieldClass()}>
                      <option value="">Selecione</option>
                      {LOSS_REASONS.map(reason => <option key={reason}>{reason}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">Complemento <span className="font-normal text-ink-subtle">(opcional)</span></span>
                    <input value={lossDetail} onChange={event => setLossDetail(event.target.value)} placeholder="Detalhe do motivo" className={fieldClass()} />
                  </label>
                </div>
              )}

              {(outcome !== 'atendeu' || answeredResult) && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                    Observação <span className="font-normal text-ink-subtle">(opcional)</span>
                  </span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="Registre um contexto ou próximo combinado."
                    rows={compact ? 2 : 3}
                    className={fieldClass('resize-none')}
                  />
                </label>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-50">
          Cancelar
        </button>
        <button type="button" onClick={submit} disabled={saving || !outcome || (outcome === 'atendeu' && !answeredResult)} className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45">
          {saving ? 'Registrando…' : 'Confirmar registro'}
        </button>
      </div>
    </div>
  )
}
