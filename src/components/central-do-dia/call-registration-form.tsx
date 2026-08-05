'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ICON } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT } from '@/lib/animations'
import { LOSS_REASONS, OUTCOMES } from '@/lib/central-do-dia/outcomes'
import type { CallRegistrationInput } from '@/lib/central-do-dia/call-registration'
import type { TaskOutcome } from '@/lib/central-do-dia/types'

function fieldClass(extra?: string) {
  return cn(
    'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-ui',
    'placeholder:text-ink-subtle focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/25',
    extra,
  )
}

export function CallRegistrationForm({ onSubmit, onCancel, compact = false }: {
  onSubmit: (input: CallRegistrationInput) => Promise<void>
  onCancel: () => void
  compact?: boolean
}) {
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null)
  const [note, setNote] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [meetingScheduled, setMeetingScheduled] = useState(false)
  const [lossReason, setLossReason] = useState('')
  const [lossDetail, setLossDetail] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!outcome) return toast.error('Escolha como foi a ligação')
    if (outcome === 'pediu_retorno' && !returnAt) return toast.error('Informe quando retornar')
    if (outcome === 'atendeu' && !note.trim()) return toast.error('Informe o que foi conversado')
    if (outcome === 'sem_interesse' && !lossReason) return toast.error('Informe o motivo da perda')

    setSaving(true)
    try {
      await onSubmit({
        outcome,
        note: note.trim() || null,
        returnAt: returnAt ? new Date(returnAt).toISOString() : null,
        meetingScheduled,
        lossReason: outcome === 'sem_interesse'
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
          {OUTCOMES.map(item => {
            const Icon = item.icon
            const active = outcome === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setOutcome(item.value)}
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
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">O que foi conversado?</span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="Contexto e próximo combinado."
                    rows={compact ? 2 : 3}
                    className={fieldClass('resize-none')}
                  />
                </label>
              )}

              {outcome === 'pediu_retorno' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">Retornar em</span>
                  <input type="datetime-local" value={returnAt} onChange={event => setReturnAt(event.target.value)} className={fieldClass()} />
                </label>
              )}

              {outcome === 'sem_interesse' && (
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

              {outcome === 'atendeu' && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-surface-sunken p-3 text-sm font-medium text-ink">
                  <input type="checkbox" checked={meetingScheduled} onChange={event => setMeetingScheduled(event.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  Marquei reunião
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
        <button type="button" onClick={submit} disabled={saving || !outcome} className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45">
          {saving ? 'Registrando…' : 'Confirmar registro'}
        </button>
      </div>
    </div>
  )
}
