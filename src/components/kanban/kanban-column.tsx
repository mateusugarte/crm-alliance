'use client'

import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { LeadCard } from './lead-card'
import type { KanbanColumnConfig } from './types'
import type { Lead } from '@/lib/supabase/types'

interface KanbanColumnProps {
  column: KanbanColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export const KanbanColumn = memo(function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const Icon = column.icon

  return (
    <div
      className="rounded-2xl min-w-[260px] max-w-[260px] flex flex-col h-full transition-all duration-150"
      style={{
        backgroundColor: isOver ? column.color + '10' : '#F9FAFB',
        outline: isOver ? `2px dashed ${column.color}` : undefined,
      }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div
          className="rounded-xl px-3 py-2.5 flex items-center justify-between"
          style={{ backgroundColor: column.color + '18' }}
        >
          <div className="flex items-center gap-2">
            <Icon size={15} strokeWidth={2} style={{ color: column.color }} />
            <span
              className="font-semibold text-xs uppercase tracking-widest"
              style={{ color: column.color }}
            >
              {column.label}
            </span>
          </div>
          <span
            className="text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: column.color }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 px-3 pb-3 overflow-y-auto flex-1"
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-xl">
            Arraste um lead aqui
          </div>
        )}
      </div>
    </div>
  )
})
