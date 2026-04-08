'use client'

import { Bot, PauseCircle, Phone, Zap, ChevronRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPhone } from '@/lib/format-phone'
import type { LeadWithLastInteraction } from './types'

interface ChatHeaderProps {
  lead: LeadWithLastInteraction
  onInfoClick: () => void
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = [
    'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)',
    'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function ChatHeader({ lead, onInfoClick }: ChatHeaderProps) {
  return (
    <TooltipProvider delay={400}>
      <div className="bg-white dark:bg-[#0F1117] px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-white/5 flex-shrink-0 shadow-sm dark:shadow-none">
        {/* Avatar + info — clicável */}
        <button
          onClick={onInfoClick}
          className="flex items-center gap-3 text-left group cursor-pointer rounded-xl px-2 py-1.5 -mx-2 -my-1.5 hover:bg-gray-50 dark:hover:bg-white/4 transition-colors duration-150"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none"
            style={{ background: getAvatarColor(lead.name) }}
          >
            {getInitials(lead.name)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{lead.name}</h2>
              <ChevronRight size={13} className="text-gray-300 dark:text-white/25 group-hover:text-gray-500 dark:group-hover:text-white/50 transition-colors" />
            </div>
            <p className="text-gray-400 dark:text-white/35 text-xs flex items-center gap-1 mt-0.5">
              <Phone size={10} />
              {formatPhone(lead.phone)}
            </p>
          </div>
        </button>

        {/* Status */}
        <div className="flex items-center gap-2">
          {lead.automation_paused ? (
            <Tooltip>
              <TooltipTrigger render={
                <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-400/20 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                  <PauseCircle size={11} /> Pausado
                </span>
              } />
              <TooltipContent side="bottom">
                IA pausada — mensagens manuais habilitadas.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger render={
                <span className="flex items-center gap-1.5 bg-alliance-blue/10 text-alliance-blue border border-alliance-blue/20 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                  <Zap size={11} /> IA ativa
                </span>
              } />
              <TooltipContent side="bottom">
                Agente de IA respondendo automaticamente.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
