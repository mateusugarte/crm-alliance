'use client'

import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Pause, Bot, MapPin, Home, Send, PhoneCall } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Lead } from '@/lib/supabase/types'
import { formatPhone } from '@/lib/format-phone'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  isOverlay?: boolean
}

export const LeadCard = memo(function LeadCard({ lead, onClick, isOverlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  })

  const displayName = lead.name?.trim() || formatPhone(lead.phone) || 'Lead sem nome'
  const isBeforeAI = lead.antes_ia === true
  const aceitouConsultor = lead.aceitou_consultor === true

  // Placeholder ghost que fica na coluna enquanto o DragOverlay segue o cursor
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        className={`rounded-xl border-2 border-dashed ${
          lead.automation_paused ? 'border-orange-200' : 'border-gray-200'
        } bg-gray-50/60`}
        style={{ minHeight: '88px' }}
      />
    )
  }

  const borderClass = lead.automation_paused
    ? 'border border-gray-100 [border-left:4px_solid_theme(colors.orange.400)]'
    : aceitouConsultor
      ? 'border border-emerald-200 dark:border-emerald-500/30 [border-left:4px_solid_theme(colors.emerald.400)]'
      : 'border border-gray-100'

  const overlayStyle = isOverlay
    ? {
        transform: 'rotate(2deg)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        cursor: 'grabbing' as const,
        pointerEvents: 'none' as const,
      }
    : undefined

  return (
    <motion.div
      ref={isOverlay ? undefined : setNodeRef}
      style={overlayStyle}
      whileHover={isOverlay ? undefined : { y: -2, transition: { duration: 0.15 } }}
      className={`bg-white dark:bg-white/5 rounded-xl p-3.5 shadow-sm dark:shadow-none select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-1
        ${isOverlay ? '' : 'cursor-pointer active:cursor-grabbing hover:shadow-md dark:hover:bg-white/8 transition-all'}
        ${borderClass}`}
      tabIndex={isOverlay ? -1 : 0}
      role={isOverlay ? undefined : 'button'}
      aria-label={isOverlay ? undefined : `Ver detalhes de ${displayName}`}
      onKeyDown={isOverlay ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      onClick={isOverlay ? undefined : (e) => {
        e.stopPropagation()
        onClick()
      }}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      <div className="flex flex-col gap-2">
        {/* Nome + badges */}
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-sm text-alliance-dark dark:text-white leading-tight">
            {displayName}
          </span>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            {aceitouConsultor && (
              <span className="inline-flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                <PhoneCall size={8} />
                quer consultor
              </span>
            )}
            {isBeforeAI && (
              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
                antes da IA
              </span>
            )}
            {lead.automation_paused && (
              <span className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
                <Pause size={9} />
                pausado
              </span>
            )}
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex flex-col gap-0.5">
          {lead.city && (
            <span className="text-xs text-gray-400 dark:text-white/35 flex items-center gap-1">
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
        <div className="border-t border-gray-50 dark:border-white/5" />

        {/* Badge IA / Consultor + tentativas de disparo */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {lead.assigned_to === null ? (
              <span className="inline-flex items-center gap-1 bg-alliance-dark text-white text-xs font-medium px-2 py-0.5 rounded-full">
                <Bot size={9} /> agente de IA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50 text-xs font-medium px-2 py-0.5 rounded-full">
                Consultor
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
            <Send size={8} />
            {lead.reactivation_count ?? 0}×
          </span>
        </div>
      </div>
    </motion.div>
  )
})
