'use client'

import { memo, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ArrowDownNarrowWide, ChevronDown, ICON } from '@/lib/icons'
import { CountPill, StageDot } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { LeadCard } from './lead-card'
import type { KanbanColumnConfig } from './types'
import type { Lead } from '@/lib/supabase/types'

const INITIAL_LIMIT = 12
const LOAD_MORE_STEP = 12

interface KanbanColumnProps {
  column: KanbanColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export const KanbanColumn = memo(function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const Icon = column.icon

  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT)
  const [sortByScore, setSortByScore] = useState(false)

  const sortedLeads = useMemo(() => {
    if (!sortByScore) return leads
    return [...leads].sort((a, b) => {
      const scoreDiff = (b.lead_score ?? 0) - (a.lead_score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [leads, sortByScore])

  const visibleLeads = sortedLeads.slice(0, visibleCount)
  const hasMore = leads.length > visibleCount
  const hiddenCount = leads.length - visibleCount

  return (
    <div
      className="flex h-full min-w-[268px] max-w-[268px] flex-col rounded-[var(--radius-panel)] bg-surface-sunken transition-ui"
      style={
        isOver
          ? { backgroundColor: column.soft, boxShadow: `inset 0 0 0 2px ${column.solid}` }
          : undefined
      }
    >
      {/* Cabeçalho — fixo enquanto a coluna rola. O estágio é comunicado por
          um ponto colorido com rótulo, não por faixa lateral. */}
      <header className="sticky top-0 z-[var(--z-sticky)] flex-shrink-0 rounded-t-[var(--radius-panel)] bg-surface-sunken px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 elev-xs">
          <div className="flex min-w-0 items-center gap-2">
            <StageDot tokens={column} size={7} />
            <Icon size={ICON.xs} style={{ color: column.solid }} className="flex-shrink-0" />
            <span className="truncate text-sm font-semibold text-ink">{column.label}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSortByScore(prev => !prev)
                setVisibleCount(INITIAL_LIMIT)
              }}
              className={cn(
                'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-ui',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                sortByScore
                  ? 'bg-ink text-surface'
                  : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink',
              )}
              title={sortByScore ? 'Voltar para últimos categorizados' : 'Ordenar por melhor score'}
              aria-pressed={sortByScore}
              aria-label={sortByScore ? 'Voltar para últimos categorizados' : 'Ordenar por melhor score'}
            >
              <ArrowDownNarrowWide size={ICON.xs} />
            </button>
            <CountPill value={leads.length} tokens={column} />
          </div>
        </div>
      </header>

      {/* Cards */}
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {visibleLeads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
        ))}

        {leads.length === 0 && (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-3 py-10 text-center text-xs text-ink-subtle">
            Arraste um lead para cá
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount(c => c + LOAD_MORE_STEP)}
            className={cn(
              'mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2',
              'text-xs font-medium text-ink-muted transition-ui hover:bg-surface hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <ChevronDown size={ICON.xs} />
            Ver mais {hiddenCount}
          </button>
        )}
      </div>
    </div>
  )
})
