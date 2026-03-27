'use client'

import { Bot, PauseCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LeadWithLastInteraction } from './types'

interface LeadsSidebarProps {
  leads: LeadWithLastInteraction[]
  activeLeadId: string | null
  onSelect: (id: string) => void
}

export function LeadsSidebar({ leads, activeLeadId, onSelect }: LeadsSidebarProps) {
  return (
    <div className="w-72 min-w-72 bg-alliance-dark flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-5 border-b border-white/10">
        <span className="font-bold text-white text-lg tracking-wide">Alliance</span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-12 px-4">
            Nenhum lead com interações ainda
          </div>
        ) : (
          leads.map(lead => {
            const isActive = lead.id === activeLeadId
            return (
              <button
                key={lead.id}
                onClick={() => onSelect(lead.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                  isActive ? 'bg-alliance-blue' : 'hover:bg-white/10'
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                  {lead.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-white text-sm truncate">{lead.name}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {lead.automation_paused && <PauseCircle size={12} className="text-amber-400" />}
                      {!lead.assigned_to && !lead.automation_paused && <Bot size={12} className="text-white/60" />}
                    </div>
                  </div>
                  <p className="text-white/60 text-xs truncate mt-0.5">{lead.lastMessage}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {formatDistanceToNow(new Date(lead.lastMessageAt), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
