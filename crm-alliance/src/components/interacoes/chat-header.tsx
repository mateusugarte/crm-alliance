import { Bot, PauseCircle } from 'lucide-react'
import type { LeadWithLastInteraction } from './types'

interface ChatHeaderProps {
  lead: LeadWithLastInteraction
}

export function ChatHeader({ lead }: ChatHeaderProps) {
  return (
    <div className="bg-alliance-dark px-5 py-4 flex items-center justify-between border-b border-white/10">
      <div>
        <h2 className="font-bold text-white">{lead.name}</h2>
        <p className="text-white/60 text-xs">{lead.phone}</p>
      </div>
      <div className="flex items-center gap-2">
        {lead.automation_paused ? (
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-xs font-medium px-2 py-1 rounded-full">
            <PauseCircle size={12} /> Automação pausada
          </span>
        ) : (
          <span className="flex items-center gap-1 bg-alliance-blue/30 text-alliance-blue text-xs font-medium px-2 py-1 rounded-full">
            <Bot size={12} /> IA ativa
          </span>
        )}
      </div>
    </div>
  )
}
