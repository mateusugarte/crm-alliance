'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Calendar, ICON } from '@/lib/icons'
import { cn } from '@/lib/utils'

type Period = 'tudo' | 'hoje' | 'semana' | 'mes' | 'personalizado'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
]

interface DateFilterProps {
  /** Renderiza sobre superfície escura (a faixa de abertura do Dashboard). */
  onDark?: boolean
}

export function DateFilter({ onDark = false }: DateFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPeriod = (searchParams.get('period') ?? 'tudo') as Period
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '')

  const navigate = (period: Period, from?: string, to?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    if (from) params.set('from', from)
    else params.delete('from')
    if (to) params.set('to', to)
    else params.delete('to')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Período"
        className={cn(
          'flex items-center gap-0.5 rounded-full p-1',
          onDark ? 'bg-white/12 backdrop-blur-sm' : 'bg-surface-sunken',
        )}
      >
        {PERIODS.map(p => {
          const active = currentPeriod === p.key
          return (
            <button
              key={p.key}
              onClick={() => navigate(p.key)}
              aria-pressed={active}
              className={cn(
                'cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-ui',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                onDark
                  ? active
                    ? 'bg-surface-fixed text-ink-fixed focus-visible:ring-white'
                    : 'text-white/65 hover:bg-white/10 hover:text-white focus-visible:ring-white/60'
                  : active
                    ? 'bg-surface text-ink elev-xs focus-visible:ring-ring'
                    : 'text-ink-muted hover:text-ink focus-visible:ring-ring',
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {currentPeriod === 'personalizado' && (
        <div className="flex items-center gap-1.5">
          <Calendar
            size={ICON.xs}
            className={cn('flex-shrink-0', onDark ? 'text-white/60' : 'text-ink-subtle')}
          />
          <input
            type="date"
            aria-label="Data inicial"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs outline-none transition-ui focus-visible:ring-2',
              onDark
                ? 'border-white/20 bg-white/10 text-white focus-visible:ring-white/60'
                : 'border-line bg-surface text-ink focus-visible:ring-ring',
            )}
          />
          <span className={onDark ? 'text-xs text-white/50' : 'text-xs text-ink-subtle'}>–</span>
          <input
            type="date"
            aria-label="Data final"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs outline-none transition-ui focus-visible:ring-2',
              onDark
                ? 'border-white/20 bg-white/10 text-white focus-visible:ring-white/60'
                : 'border-line bg-surface text-ink focus-visible:ring-ring',
            )}
          />
          <button
            onClick={() => navigate('personalizado', fromDate, toDate)}
            disabled={!fromDate || !toDate}
            className={cn(
              'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-ui disabled:cursor-not-allowed disabled:opacity-40',
              onDark ? 'bg-surface-fixed text-ink-fixed hover:bg-white/90' : 'bg-brand text-white hover:bg-brand-hover',
            )}
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
