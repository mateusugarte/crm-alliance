'use client'

import { useDraggable } from '@dnd-kit/core'
import { Pause, Bot, MapPin, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Lead } from '@/lib/supabase/types'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^55/, '')
  return digits.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px) rotate(1.5deg) scale(1.02)`,
        boxShadow: '0 16px 32px rgba(0,0,0,0.16)',
        zIndex: 50,
        position: 'relative' as const,
      }
    : undefined

  const displayName = lead.name?.trim() || formatPhone(lead.phone) || 'Lead sem nome'

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`bg-white rounded-xl p-3.5 shadow-sm cursor-pointer active:cursor-grabbing select-none transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-1 ${
        isDragging ? 'opacity-40' : ''
      } ${
        lead.automation_paused
          ? 'border border-gray-100 border-l-4 border-l-orange-400'
          : 'border border-gray-100'
      }`}
      aria-label={`Ver detalhes de ${displayName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Nome + badge pausado */}
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-sm text-alliance-dark leading-tight">
            {displayName}
          </span>
          {lead.automation_paused && (
            <span className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
              <Pause size={9} />
              pausado
            </span>
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

        {/* Badge IA / Consultor */}
        <div>
          {lead.assigned_to === null ? (
            <span className="inline-flex items-center gap-1 bg-alliance-dark text-white text-xs font-medium px-2 py-0.5 rounded-full transition-colors duration-300">
              <Bot size={9} /> agente de IA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full transition-colors duration-300">
              Consultor
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
