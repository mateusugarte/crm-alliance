'use client'

import { motion } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { PauseCircle, Bot, MapPin, Home } from 'lucide-react'
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
      whileDrag={{ scale: 1.03, boxShadow: '0 12px 32px rgba(10,46,173,0.15)' }}
      className={`bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50 z-50 shadow-xl' : ''
      }`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Nome + pausa */}
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-sm text-alliance-dark leading-tight">
            {lead.name}
          </span>
          {lead.automation_paused && (
            <PauseCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          )}
        </div>

        {/* Detalhes */}
        <div className="flex flex-col gap-0.5">
          {lead.city && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={10} className="flex-shrink-0" />
              {lead.city}
            </span>
          )}
          {lead.imovel_interesse && (
            <span className="text-xs text-alliance-blue font-medium flex items-center gap-1">
              <Home size={10} className="flex-shrink-0" />
              {lead.imovel_interesse}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-gray-50" />

        {/* Badge */}
        <div>
          {lead.assigned_to === null ? (
            <span className="inline-flex items-center gap-1 bg-alliance-dark text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <Bot size={9} /> agente de IA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
              Consultor
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
