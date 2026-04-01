'use client'

import { Bot, PauseCircle, Phone } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPhone } from '@/lib/format-phone'
import type { LeadWithLastInteraction } from './types'

interface ChatHeaderProps {
  lead: LeadWithLastInteraction
}

export function ChatHeader({ lead }: ChatHeaderProps) {
  return (
    <TooltipProvider delay={400}>
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm flex-shrink-0">
        {/* Avatar + info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-alliance-dark flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-alliance-dark text-sm">{lead.name}</h2>
            <p className="text-gray-400 text-xs flex items-center gap-1">
              <Phone size={10} />
              {formatPhone(lead.phone)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {lead.automation_paused ? (
            <Tooltip>
              <TooltipTrigger render={
                <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                  <PauseCircle size={12} /> Automação pausada
                </span>
              } />
              <TooltipContent side="bottom">
                A IA não responde a este lead. Mensagens manuais estão habilitadas.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger render={
                <span className="flex items-center gap-1.5 bg-alliance-blue/10 text-alliance-blue border border-alliance-blue/20 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                  <Bot size={12} /> IA ativa
                </span>
              } />
              <TooltipContent side="bottom">
                O agente de IA está respondendo automaticamente.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
