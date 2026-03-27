'use client'

import { useDroppable } from '@dnd-kit/core'
import { LeadCard } from './lead-card'
import type { KanbanColumnConfig } from './types'
import type { Lead } from '@/lib/supabase/types'

interface KanbanColumnProps {
  column: KanbanColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      className={`bg-alliance-col rounded-xl min-w-[280px] max-w-[280px] flex flex-col transition-colors ${
        isOver ? 'ring-2 ring-alliance-blue ring-inset' : ''
      }`}
    >
      {/* Header */}
      <div
        className="p-3 rounded-t-xl border-t-4"
        style={{ borderColor: column.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{column.icon}</span>
            <span className="font-semibold text-sm text-alliance-dark">{column.label}</span>
          </div>
          <span
            className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
            style={{ backgroundColor: column.color }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-3 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">
            Sem leads aqui
          </div>
        )}
      </div>
    </div>
  )
}
