'use client'

import { motion } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { PauseCircle, Bot } from 'lucide-react'
import type { Lead } from '@/lib/supabase/types'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-sm text-alliance-dark leading-tight">{lead.name}</span>
          {lead.automation_paused && (
            <PauseCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          )}
        </div>

        <span className="text-xs text-gray-500">{lead.phone}</span>

        {lead.city && (
          <span className="text-xs text-gray-400">{lead.city}</span>
        )}

        {lead.imovel_interesse && (
          <span className="text-xs text-alliance-blue font-medium">{lead.imovel_interesse}</span>
        )}

        {/* Badge */}
        <div className="mt-1">
          {lead.assigned_to === null ? (
            <span className="inline-flex items-center gap-1 bg-alliance-dark text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <Bot size={10} /> agente de IA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
              Consultor
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
