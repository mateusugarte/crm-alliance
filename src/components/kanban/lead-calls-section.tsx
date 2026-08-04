'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck, Clock, Loader2, ICON } from '@/lib/icons'
import { outcomeConfig } from '@/lib/central-do-dia/outcomes'
import type { LeadCall } from '@/app/api/leads/[id]/calls/route'

/**
 * Histórico de ligações do lead.
 *
 * Fecha o ciclo da Central do Dia: o corretor registrava o desfecho na fila do
 * dashboard e o registro não voltava para lugar nenhum. Aqui ele vira a
 * memória do relacionamento — o que já foi tentado, o que foi conversado e
 * quando retornar.
 *
 * A RLS de `ligacoes` restringe a leitura ao próprio responsável (e ao ADM),
 * então um corretor não vê as ligações de outro. É a política do banco, não
 * uma decisão desta tela.
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

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/leads/${leadId}/calls`, { cache: 'no-store' })
      .then(response => response.json() as Promise<{ data?: LeadCall[] }>)
      .then(json => { if (active) setCalls(json.data ?? []) })
      .catch(() => { if (active) setCalls([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [leadId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-ink-subtle">
        <Loader2 size={ICON.xs} className="animate-spin" />
        Carregando ligações…
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <p className="py-3 text-xs leading-relaxed text-ink-subtle">
        Nenhuma ligação registrada ainda. Quando você registrar uma pela Central do Dia,
        o desfecho e as anotações aparecem aqui.
      </p>
    )
  }

  const nextReturn = calls.find(call => call.returnAt && new Date(call.returnAt) > new Date())

  return (
    <div className="space-y-2.5">
      {nextReturn?.returnAt && (
        <p className="flex items-center gap-1.5 rounded-lg bg-[var(--stage-frio-soft)] px-2.5 py-2 text-2xs font-medium text-[var(--stage-frio-ink)]">
          <Clock size={ICON.xs} className="flex-shrink-0" />
          Retornar {formatDistanceToNow(new Date(nextReturn.returnAt), { locale: ptBR, addSuffix: true })}
        </p>
      )}

      <ol className="space-y-2.5">
        {calls.map(call => {
          const config = outcomeConfig(call.outcome)
          const Icon = config.icon
          return (
            <li key={call.id} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: config.tone.soft, color: config.tone.ink }}
              >
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-2xs">
                  <span className="font-semibold" style={{ color: config.tone.ink }}>
                    {config.pastLabel}
                  </span>
                  <span className="text-ink-subtle">{whenLabel(call.registeredAt)}</span>
                </p>
                {call.note && (
                  <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{call.note}</p>
                )}
                {call.meetingScheduled && call.meetingAt && (
                  <p className="mt-1 flex items-center gap-1 text-2xs font-medium text-[var(--success-ink)]">
                    <CalendarCheck size={11} className="flex-shrink-0" />
                    Reunião em {format(new Date(call.meetingAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                <p className="mt-0.5 text-2xs text-ink-subtle">por {call.ownerName}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
