'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Calendar } from 'lucide-react'

type Period = 'hoje' | 'semana' | 'mes' | 'personalizado'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
]

export function DateFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPeriod = (searchParams.get('period') ?? 'semana') as Period
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
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/8 rounded-xl p-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => {
              if (p.key !== 'personalizado') navigate(p.key)
              else navigate('personalizado')
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentPeriod === p.key
                ? 'bg-white dark:bg-white/15 text-alliance-blue dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {currentPeriod === 'personalizado' && (
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-white outline-none"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-white outline-none"
          />
          <button
            onClick={() => navigate('personalizado', fromDate, toDate)}
            disabled={!fromDate || !toDate}
            className="px-3 py-1.5 rounded-lg text-xs bg-alliance-blue text-white font-medium hover:bg-alliance-blue/90 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
