'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck, ChevronDown, Clock, Loader2, PhoneCall, ICON } from '@/lib/icons'
import { outcomeConfig } from '@/lib/central-do-dia/outcomes'
import type { LeadCall } from '@/app/api/leads/[id]/calls/route'
import type { CallRegistrationInput } from '@/lib/central-do-dia/call-registration'
import type { TaskCompletionResult } from '@/lib/central-do-dia/types'
import { CallRegistrationForm } from '@/components/central-do-dia/call-registration-form'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/**
 * Histórico de ligações do lead.
 *
 * Fecha o ciclo da Central do Dia: o corretor registrava o desfecho na fila do
 * dashboard e o registro não voltava para lugar nenhum. Aqui ele vira a
 * memória do relacionamento — o que já foi tentado, o que foi conversado e
 * quando retornar.
 *
 * O histórico é compartilhado pela equipe para que o relacionamento não fique
 * preso ao corretor que registrou a tentativa.
 */

function whenLabel(value: string) {
  const date = new Date(value)
  if (isToday(date)) return `hoje, ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `ontem, ${format(date, 'HH:mm')}`
  return format(date, "dd/MM 'às' HH:mm", { locale: ptBR })
}

export function LeadCallsSection({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<LeadCall[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)

  const load = useCallback((quiet = false) => {
    let active = true
    if (!quiet) setLoading(true)
    fetch(`/api/leads/${leadId}/calls`, { cache: 'no-store' })
      .then(response => response.json() as Promise<{ data?: LeadCall[] }>)
      .then(json => { if (active) setCalls(json.data ?? []) })
      .catch(() => { if (active) setCalls([]) })
      .finally(() => { if (active && !quiet) setLoading(false) })
    return () => { active = false }
  }, [leadId])

  useEffect(() => load(), [load])
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`lead-calls-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligacoes', filter: `lead_id=eq.${leadId}` }, () => load(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [leadId, load])

  async function register(input: CallRegistrationInput) {
    const response = await fetch(`/api/leads/${leadId}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await response.json() as { data?: TaskCompletionResult; error?: string }
    if (!response.ok || !json.data) throw new Error(json.error || 'Erro ao registrar ligação')
    setRegistering(false)
    load(true)
  }

  const nextReturn = calls.find(call => call.returnAt && new Date(call.returnAt) > new Date())

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setRegistering(value => !value)}
          aria-expanded={registering}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-2xs font-medium text-ink-muted transition-ui hover:border-brand hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PhoneCall size={12} />
          {registering ? 'Fechar' : 'Registrar ligação'}
        </button>
      </div>

      {registering && (
        <CallRegistrationForm onSubmit={register} onCancel={() => setRegistering(false)} compact />
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-ink-subtle">
          <Loader2 size={ICON.xs} className="animate-spin" />
          Carregando ligações…
        </div>
      ) : calls.length === 0 ? (
        <p className="py-3 text-xs leading-relaxed text-ink-subtle">
          Nenhuma ligação registrada ainda. Use o botão acima ou registre pela Central do Dia;
          o horário, o desfecho e as anotações aparecerão aqui.
        </p>
      ) : <>
      {nextReturn?.returnAt && (
        <p className="flex items-center gap-1.5 rounded-lg bg-[var(--stage-frio-soft)] px-2.5 py-2 text-2xs font-medium text-[var(--stage-frio-ink)]">
          <Clock size={ICON.xs} className="flex-shrink-0" />
          Retornar {formatDistanceToNow(new Date(nextReturn.returnAt), { locale: ptBR, addSuffix: true })}
        </p>
      )}

      <ol className="divide-y divide-black/[0.05]">
        {calls.map(call => {
          const config = outcomeConfig(call.outcome)
          const Icon = config.icon
          const expanded = expandedId === call.id
          const hasDetail = Boolean(call.note || call.meetingScheduled || call.returnAt)
          return (
            <li key={call.id} className="py-2.5 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => hasDetail && setExpandedId(expanded ? null : call.id)}
                aria-expanded={expanded}
                disabled={!hasDetail}
                className="flex w-full items-center gap-2.5 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: config.tone.soft, color: config.tone.ink }}
                >
                  <Icon size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold" style={{ color: config.tone.ink }}>{config.pastLabel}</span>
                  <span className="block text-2xs text-ink-subtle">{whenLabel(call.registeredAt)} · {call.ownerName}</span>
                </span>
                {hasDetail && <ChevronDown size={12} className={cn('text-ink-subtle transition-transform', expanded && 'rotate-180')} />}
              </button>
              {expanded && (
                <div className="ml-9 mt-2 rounded-lg bg-surface-sunken px-3 py-2.5">
                  {call.note && <p className="text-xs leading-relaxed text-ink-muted">{call.note}</p>}
                  {call.meetingScheduled && (
                    <p className="mt-1.5 flex items-center gap-1 text-2xs font-medium text-[var(--success-ink)]">
                      <CalendarCheck size={11} className="flex-shrink-0" />Reunião marcada
                    </p>
                  )}
                  {call.returnAt && (
                    <p className="mt-1.5 flex items-center gap-1 text-2xs font-medium text-[var(--stage-frio-ink)]">
                      <Clock size={11} className="flex-shrink-0" />Retorno em {whenLabel(call.returnAt)}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      </>}
    </div>
  )
}
