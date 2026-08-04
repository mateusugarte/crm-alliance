'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { differenceInCalendarDays, format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowRight, CalendarCheck, Check, ChevronDown,
  Clock, PhoneCall, ICON,
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { stageLabel, stageTokens } from '@/lib/stages'
import { DURATION, EASE_OUT } from '@/lib/animations'
import { LOSS_REASONS, OUTCOMES, outcomeConfig } from '@/lib/central-do-dia/outcomes'
import type { DailyTaskItem, TaskCompletionResult, TaskOutcome } from '@/lib/central-do-dia/types'

/* -------------------------------------------------------------------------
   Rótulos
   ---------------------------------------------------------------------- */

function dueLabel(task: DailyTaskItem) {
  const due = new Date(task.dueAt)
  if (task.status === 'vencida' || (task.status !== 'feita' && due.getTime() < Date.now())) {
    return `atrasada ${formatDistanceToNow(due, { locale: ptBR, addSuffix: true })}`
  }
  if (isToday(due)) return format(due, 'HH:mm')
  if (isTomorrow(due)) return `amanhã ${format(due, 'HH:mm')}`
  return format(due, "dd/MM 'às' HH:mm", { locale: ptBR })
}

/** Estado da tentativa — o dado que decide se vale ligar agora. */
function attemptLabel(task: DailyTaskItem) {
  if (task.attemptNumber > 1) return `${task.attemptNumber}ª tentativa`
  if (!task.lastContactAt) return 'nunca ligado'
  return `sem contato há ${formatDistanceToNow(new Date(task.lastContactAt), { locale: ptBR })}`
}

function daysWithoutContact(task: DailyTaskItem, now: number) {
  const days = Math.max(0, differenceInCalendarDays(new Date(now), new Date(task.noContactSince)))
  return `${days} D sem contato`
}

function durationLabel(milliseconds: number) {
  const absoluteMinutes = Math.max(0, Math.floor(Math.abs(milliseconds) / 60_000))
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60
  if (hours === 0) return `${minutes}min`
  return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`
}

function qualificationLabels(task: DailyTaskItem, now: number) {
  if (task.origin !== 'qualificacao' || !task.qualifiedAt) return null
  const qualifiedAt = new Date(task.qualifiedAt).getTime()
  const dueAt = new Date(task.dueAt).getTime()
  return {
    recent: dueAt >= now,
    qualified: `Qualificou há ${durationLabel(now-qualifiedAt)}`,
    timer: dueAt >= now ? `${durationLabel(dueAt-now)} restantes` : `Atrasado há ${durationLabel(now-dueAt)}`,
  }
}

/* -------------------------------------------------------------------------
   Registro do desfecho
   ---------------------------------------------------------------------- */

function fieldClass(extra?: string) {
  return cn(
    'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-ui',
    'placeholder:text-ink-subtle focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/25',
    extra,
  )
}

function TaskRegistration({ task, onDone, onCancel }: {
  task: DailyTaskItem
  onDone: (result: TaskCompletionResult) => void
  onCancel: () => void
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
      const combinedReason = outcome === 'sem_interesse'
        ? [lossReason, lossDetail.trim()].filter(Boolean).join(': ')
        : null
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          note,
          returnAt: returnAt ? new Date(returnAt).toISOString() : null,
          meetingScheduled,
          lossReason: combinedReason,
        }),
      })
      const json = await response.json() as { data?: TaskCompletionResult; error?: string }
      if (!response.ok) throw new Error(json.error || 'Erro ao registrar ligação')
      if (!json.data) throw new Error('O servidor não devolveu o registro da ligação')
      toast.success('Ligação registrada')
      onDone(json.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar ligação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
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
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-ui',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !active && 'border-line-strong bg-surface text-ink-muted hover:border-line-strong hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <Icon size={ICON.xs} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Os campos abaixo só existem depois que o desfecho é escolhido: antes
          disso não há pergunta a fazer, e mostrar tudo de uma vez foi
          justamente o que deixou esta área confusa. */}
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
                    placeholder="Anote o contexto, a necessidade e o que ficou combinado."
                    rows={2}
                    className={fieldClass('resize-none')}
                  />
                </label>
              )}

              {outcome === 'pediu_retorno' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">Retornar em</span>
                  <input
                    type="datetime-local"
                    value={returnAt}
                    onChange={event => setReturnAt(event.target.value)}
                    className={fieldClass()}
                  />
                </label>
              )}

              {outcome === 'sem_interesse' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">Motivo da perda</span>
                    <select
                      value={lossReason}
                      onChange={event => setLossReason(event.target.value)}
                      className={fieldClass()}
                    >
                      <option value="">Selecione</option>
                      {LOSS_REASONS.map(reason => <option key={reason}>{reason}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Complemento <span className="font-normal text-ink-subtle">(opcional)</span>
                    </span>
                    <input
                      value={lossDetail}
                      onChange={event => setLossDetail(event.target.value)}
                      placeholder="Detalhe do motivo"
                      className={fieldClass()}
                    />
                  </label>
                </div>
              )}

              {outcome === 'atendeu' && (
                <div className="rounded-lg bg-surface-sunken p-3">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={meetingScheduled}
                      onChange={event => setMeetingScheduled(event.target.checked)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    Marquei reunião
                  </label>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition-ui hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !outcome}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-ui hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? 'Registrando…' : 'Registrar ligação'}
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------
   Linha da fila
   ---------------------------------------------------------------------- */

function TaskRow({ task, onRegistered, onUndone }: {
  task: DailyTaskItem
  onRegistered: (result: TaskCompletionResult) => void
  onUndone: (result: TaskCompletionResult) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const panelId = useId()
  const reduced = useReducedMotion()

  const tokens = stageTokens(task.stage)
  const done = task.status === 'feita'
  const late = task.status === 'vencida'
  const call = task.call
  const outcome = call ? outcomeConfig(call.outcome) : null
  const qualification = qualificationLabels(task, now)

  useEffect(() => {
    if (task.origin !== 'qualificacao' || done) return
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [done, task.origin])

  async function undo() {
    if (!call || !window.confirm('Desfazer este registro de ligação?')) return
    const response = await fetch(`/api/tasks/${task.id}/complete?callId=${call.id}`, { method: 'DELETE' })
    const json = await response.json() as { data?: TaskCompletionResult; error?: string }
    if (!response.ok || !json.data) return toast.error(json.error || 'Não foi possível desfazer o registro')
    toast.success('Registro desfeito')
    onUndone(json.data)
  }

  function startRegistration() {
    setExpanded(true)
    setRegistering(true)
  }

  return (
    <article className={cn(
      'relative border-t border-line first:border-t-0',
      done && 'bg-surface-sunken/40',
      qualification?.recent && !done && 'bg-brand-soft/55 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-brand',
    )}>
      {/* Linha colapsada — altura fixa, escaneável de uma passada.
          Tudo que era parágrafo solto na tela virou conteúdo do expandido. */}
      <div className="flex items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          onClick={() => done ? undo() : startRegistration()}
          title={done ? 'Desfazer registro' : 'Registrar ligação'}
          aria-label={done ? `Desfazer registro de ${task.leadName}` : `Registrar ligação para ${task.leadName}`}
          style={done && outcome ? { backgroundColor: outcome.tone.soft, color: outcome.tone.ink, borderColor: 'transparent' } : undefined}
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-ui',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !done && 'border-line-strong bg-surface text-ink-muted hover:border-brand hover:bg-brand-soft hover:text-brand',
          )}
        >
          {done ? <Check size={ICON.sm} /> : <PhoneCall size={ICON.sm} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5">
            <span className={cn('truncate text-base font-semibold', done ? 'text-ink-muted' : 'text-ink')}>
              {task.leadName}
            </span>
            <span className="flex flex-shrink-0 items-center gap-1.5">
              <span
                className="inline-flex h-5 items-center gap-1.5 rounded-md px-2 text-2xs font-medium leading-none"
                style={{ backgroundColor: tokens.soft, color: tokens.ink }}
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tokens.solid }} />
                {stageLabel(task.stage)}
              </span>
              {task.attemptNumber > 1 && (
                <span
                  title={`${task.attemptNumber}ª tentativa de contato`}
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-sunken px-1.5 text-2xs font-semibold tabular-nums leading-none text-ink-muted"
                >
                  {task.attemptNumber}
                </span>
              )}
              <span className="inline-flex h-5 items-center rounded-full bg-surface px-2 text-2xs font-semibold tabular-nums text-ink shadow-sm">
                {task.score.toFixed(1).replace('.', ',')}
              </span>
              {qualification?.recent && !done && (
                <span className="inline-flex h-5 items-center rounded-md bg-brand px-2 text-2xs font-semibold text-white">
                  <span className="sm:hidden">Recente</span>
                  <span className="hidden sm:inline">Qualificado recente</span>
                </span>
              )}
            </span>
          </span>

          {/* Resumo do estado à direita: feita mostra o desfecho, pendente
              mostra a tentativa e o vencimento. */}
          <span className="hidden flex-shrink-0 items-center gap-3 text-xs md:flex">
            {done && outcome ? (
              <span className="font-medium" style={{ color: outcome.tone.ink }}>{outcome.pastLabel}</span>
            ) : null}
            <span className={cn('flex items-center gap-1 tabular-nums', late ? 'font-medium text-[var(--warning-ink)]' : 'text-ink-subtle')}>
              {late && <AlertTriangle size={12} />}
              {done && call ? format(new Date(call.registeredAt), 'HH:mm') : dueLabel(task)}
            </span>
            {qualification && !done && (
              <span className={cn('font-medium tabular-nums', late ? 'text-[var(--warning-ink)]' : 'text-brand')}>
                {qualification.timer}
              </span>
            )}
            {!done && (
              <span className="min-w-[7.5rem] text-right font-medium tabular-nums text-ink-muted">
                {daysWithoutContact(task, now)}
              </span>
            )}
          </span>

          <motion.span
            aria-hidden
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink-subtle"
          >
            <ChevronDown size={ICON.sm} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 pl-16 sm:px-5 sm:pb-4 sm:pl-[4.25rem]">
              <p className="text-xs text-ink-muted">
                {task.origin === 'qualificacao' && task.qualifiedAt
                  ? qualification?.qualified
                  : attemptLabel(task)}
                {' · '}{task.interactionCount} interações
                {' · '}{daysWithoutContact(task, now)}
                <span className="md:hidden">{' · '}{done && call ? format(new Date(call.registeredAt), 'HH:mm') : dueLabel(task)}</span>
                {qualification && !done && <span className="md:hidden">{' · '}{qualification.timer}</span>}
              </p>

              {done && call ? (
                <div className="rounded-[var(--radius-card)] bg-surface-sunken p-3.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium" style={{ color: outcome!.tone.ink }}>{outcome!.pastLabel}</span>
                    <span className="text-ink-subtle">
                      às {format(new Date(call.registeredAt), 'HH:mm')}
                    </span>
                    {call.meetingScheduled && (
                      <span className="inline-flex items-center gap-1 text-[var(--success-ink)]">
                        <CalendarCheck size={ICON.xs} /> reunião marcada
                      </span>
                    )}
                  </p>
                  {call.note && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{call.note}</p>}
                </div>
              ) : (
                (task.briefing || task.summary) && (
                  <div className="space-y-2.5 rounded-[var(--radius-card)] bg-surface-sunken p-3.5">
                    <p className="max-w-[70ch] text-sm leading-relaxed text-ink">
                      {task.summary || task.briefing?.contexto}
                    </p>
                    {task.briefing?.abertura && (
                      <p className="text-sm leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">Abrir por:</span>{' '}
                        <span className="italic">“{task.briefing.abertura}”</span>
                      </p>
                    )}
                    {task.briefing?.objecao_provavel && (
                      <p className="text-sm leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">Objeção provável:</span>{' '}
                        {task.briefing.objecao_provavel}
                      </p>
                    )}
                  </div>
                )
              )}

              {registering && !done ? (
                <TaskRegistration
                  task={task}
                  onCancel={() => setRegistering(false)}
                  onDone={(result) => { setRegistering(false); setExpanded(false); onRegistered(result) }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {!done && (
                    <button
                      type="button"
                      onClick={() => setRegistering(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-ui hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <PhoneCall size={ICON.xs} />
                      Registrar ligação
                    </button>
                  )}
                  <Link
                    href={`/kanban?lead=${task.leadId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3.5 py-2 text-sm font-medium text-ink-muted transition-ui hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Abrir lead
                    <ArrowRight size={ICON.xs} />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

/* -------------------------------------------------------------------------
   Central do Dia
   ---------------------------------------------------------------------- */

export function DailyTaskCenter() {
  const [view, setView] = useState<'today' | 'week'>('today')
  const [tasks, setTasks] = useState<DailyTaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    if (!quiet) setLoadError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(`/api/tasks?view=${view}`, { cache: 'no-store', signal: controller.signal })
      const json = await response.json() as { data?: DailyTaskItem[]; error?: string }
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar a fila')
      setTasks(json.data ?? [])
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'A fila demorou para responder.'
        : error instanceof Error ? error.message : 'Erro ao carregar a fila'
      if (!quiet) {
        setLoadError(message)
        toast.error(message)
      }
    } finally {
      window.clearTimeout(timeout)
      if (!quiet) setLoading(false)
    }
  }, [view])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('central-do-dia-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, () => void load(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])

  const pending = tasks.filter(task => task.status !== 'feita')
  const done = tasks.filter(task => task.status === 'feita')
  const displayed = showDone ? tasks : pending
  const late = pending.filter(task => task.status === 'vencida').length

  const groups = useMemo(() => {
    if (view === 'today') return [{ key: 'today', label: null, tasks: displayed }]
    const map = new Map<string, DailyTaskItem[]>()
    for (const task of displayed) {
      const key = format(new Date(task.queueDate ? `${task.queueDate}T12:00:00` : task.dueAt), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({
      key,
      label: format(new Date(`${key}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR }),
      tasks: values,
    }))
  }, [displayed, view])

  const answered = done.filter(task => task.call && outcomeConfig(task.call.outcome).isContact).length
  const meetings = done.filter(task => task.call?.meetingScheduled).length
  const progress = tasks.length > 0 ? (done.length / tasks.length) * 100 : 0

  const applyRegistered = useCallback((result: TaskCompletionResult) => {
    setTasks(current => current.map(task => task.id === result.task.id ? {
      ...task,
      status: 'feita',
      completedAt: result.task.completedAt,
      stage: result.lead.stage,
      attempts: result.lead.attempts,
      firstCallAt: result.lead.firstCallAt,
      lastContactAt: result.lead.lastContactAt,
      call: result.call,
    } : task))
    void load(true)
  }, [load])

  const applyUndone = useCallback((result: TaskCompletionResult) => {
    setTasks(current => current.map(task => task.id === result.task.id ? {
      ...task,
      status: 'pendente',
      completedAt: null,
      stage: result.lead.stage,
      attempts: result.lead.attempts,
      firstCallAt: result.lead.firstCallAt,
      lastContactAt: result.lead.lastContactAt,
      call: null,
    } : task))
    void load(true)
  }, [load])

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface elev-sm">
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand text-white">
              <PhoneCall size={ICON.md} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Follow Up do Dia: Ligações</h2>
              <p className="text-xs text-ink-muted">
                {pending.length === 0
                  ? 'Fila do dia concluída'
                  : `${pending.length} ${pending.length === 1 ? 'contato para follow up hoje' : 'contatos para follow up hoje'}`}
                {late > 0 && <span className="text-[var(--warning-ink)]"> · {late} atrasada{late > 1 ? 's' : ''}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-surface-sunken p-1" role="group" aria-label="Período da fila">
              {(['today', 'week'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    view === option ? 'bg-surface text-ink elev-xs' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {option === 'today' ? 'Hoje' : 'Semana'}
                </button>
              ))}
            </div>
            <span className="hidden text-xs tabular-nums text-ink-muted sm:inline">
              {done.length} de {tasks.length}
            </span>
          </div>
        </div>

        {/* Progresso da fila — leitura de uma olhada, sem ocupar linha própria */}
        {tasks.length > 0 && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
            <motion.div
              className="h-full rounded-full bg-[var(--success)]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            />
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-ink-muted">Carregando ligações…</div>
      ) : loadError ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
          <AlertTriangle size={ICON.lg} className="text-[var(--warning-ink)]" />
          <p className="mt-2 text-sm font-medium text-ink">Não foi possível carregar os follow ups.</p>
          <p className="mt-1 text-xs text-ink-muted">{loadError}</p>
          <button onClick={() => void load()} className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-sunken">
            Tentar novamente
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success-ink)]">
            <Check size={ICON.lg} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">Nenhuma ligação pendente.</p>
          <p className="mt-1 max-w-[42ch] text-xs text-ink-muted">
            Leads qualificados entram aqui imediatamente. Os demais follow ups são organizados automaticamente.
          </p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success-ink)]">
            <Check size={ICON.lg} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">Todas as {done.length} ligações do dia foram feitas.</p>
          <button
            onClick={() => setShowDone(true)}
            className="mt-2 text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver o que foi registrado
          </button>
        </div>
      ) : (
        <>
          {groups.map(group => (
            <div key={group.key}>
              {group.label && (
                <p className="border-t border-line bg-surface-sunken px-4 py-2 text-xs font-medium text-ink-muted first-letter:uppercase sm:px-5">
                  {group.label}
                </p>
              )}
              {group.tasks.map(task => (
                <TaskRow key={task.id} task={task} onRegistered={applyRegistered} onUndone={applyUndone} />
              ))}
            </div>
          ))}
        </>
      )}

      {done.length > 0 && displayed.length > 0 && (
        <button
          onClick={() => setShowDone(value => !value)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-xs font-medium text-ink-muted transition-ui hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <motion.span aria-hidden animate={{ rotate: showDone ? 180 : 0 }} transition={{ duration: DURATION.base, ease: EASE_OUT }} className="flex">
            <ChevronDown size={ICON.xs} />
          </motion.span>
          {showDone ? 'Ocultar concluídas' : `Mostrar ${done.length} concluída${done.length > 1 ? 's' : ''}`}
        </button>
      )}

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line bg-surface-sunken px-4 py-3 text-xs text-ink-muted sm:px-5">
        <span className="flex items-center gap-1.5"><PhoneCall size={ICON.xs} /> {done.length} registradas</span>
        <span className="flex items-center gap-1.5"><Check size={ICON.xs} /> {answered} falaram com o lead</span>
        <span className="flex items-center gap-1.5"><CalendarCheck size={ICON.xs} /> {meetings} viraram reunião</span>
        {late > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-[var(--warning-ink)]">
            <Clock size={ICON.xs} /> {late} atrasada{late > 1 ? 's' : ''}
          </span>
        )}
      </footer>
    </section>
  )
}
