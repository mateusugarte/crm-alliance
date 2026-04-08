'use client'

import { Bot, PauseCircle, Phone, Zap } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPhone } from '@/lib/format-phone'
import type { LeadWithLastInteraction } from './types'

interface ChatHeaderProps {
  lead: LeadWithLastInteraction
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

export function ChatHeader({ lead }: ChatHeaderProps) {
  return (
    <TooltipProvider delay={400}>
      <div
        className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Avatar + info */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none"
            style={{ background: getAvatarColor(lead.name) }}
          >
            {getInitials(lead.name)}
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-tight">{lead.name}</h2>
            <p className="text-white/35 text-xs flex items-center gap-1 mt-0.5">
              <Phone size={10} />
              {formatPhone(lead.phone)}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {lead.automation_paused ? (
            <Tooltip>
              <TooltipTrigger render={
                <span
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none"
                  style={{
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    color: '#FBB024',
                  }}
                >
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
                <span
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full cursor-default select-none"
                  style={{
                    background: 'rgba(30,144,255,0.1)',
                    border: '1px solid rgba(30,144,255,0.2)',
                    color: '#1E90FF',
                  }}
                >
                  <Zap size={11} /> IA ativa
                </span>
              } />
              <TooltipContent side="bottom">
                Agente de IA respondendo automaticamente.
              </TooltipContent>
            </Tooltip>
          )}

          {lead.assigned_to && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full select-none"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                color: '#10B981',
              }}
            >
              <Bot size={11} /> Atribuído
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
