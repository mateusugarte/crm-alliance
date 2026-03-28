'use client'

import { Bot, PauseCircle, Phone } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LeadWithLastInteraction } from './types'

interface ChatHeaderProps {
  lead: LeadWithLastInteraction
}

export function ChatHeader({ lead }: ChatHeaderProps) {
  return (
    <TooltipProvider delay={400}>
      {/* shadow-card substitui shadow-sm — borda-b mantida pois delimita sem elevação */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-card flex-shrink-0">
        {/* Avatar + info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-alliance-dark flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div>
            {/* Nome do lead: text-subtitle semântico */}
            <h2 className="text-subtitle text-alliance-dark">{lead.name}</h2>
            {/* Telefone: text-caption semântico */}
            <p className="text-caption text-gray-400 flex items-center gap-1">
              <Phone size={10} />
              {lead.phone}
            </p>
          </div>
        </div>

        {/* Status badge com tooltip */}
        <div className="flex items-center gap-2">
          {lead.automation_paused ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                    <PauseCircle size={12} /> Automacao pausada
                  </span>
                }
              />
              <TooltipContent side="bottom">
                A IA nao responde a este lead. Mensagens manuais estao habilitadas.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex items-center gap-1.5 bg-alliance-blue/10 text-alliance-blue border border-alliance-blue/20 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none">
                    <Bot size={12} /> IA ativa
                  </span>
                }
              />
              <TooltipContent side="bottom">
                O agente de IA esta respondendo automaticamente.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
