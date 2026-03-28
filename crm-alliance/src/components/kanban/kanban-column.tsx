'use client'

import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { LeadCard } from './lead-card'
import { staggerContainer, staggerItem } from '@/lib/animations'
import type { KanbanColumnConfig } from './types'
import type { Lead } from '@/lib/supabase/types'

interface KanbanColumnProps {
  column: KanbanColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const Icon = column.icon

  return (
    <div
      className="rounded-2xl min-w-[260px] max-w-[260px] flex flex-col h-full transition-all duration-150"
      style={{
        backgroundColor: isOver ? column.color + '10' : '#E8E8E8',
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

      {/* Cards — staggerChildren ao carregar a coluna */}
      <motion.div
        ref={setNodeRef}
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-2 px-3 pb-3 overflow-y-auto flex-1"
      >
        {leads.map((lead) => (
          <motion.div key={lead.id} variants={staggerItem}>
            <LeadCard
              lead={lead}
              onClick={() => onLeadClick(lead)}
            />
          </motion.div>
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-10 border-2 border-dashed border-gray-300 rounded-xl">
            Arraste um lead aqui
          </div>
        )}
      </motion.div>
    </div>
  )
}
