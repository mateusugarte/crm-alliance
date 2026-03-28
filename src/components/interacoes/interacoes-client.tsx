'use client'

import { useState } from 'react'
import { LeadsSidebar } from './leads-sidebar'
import { ChatHeader } from './chat-header'
import { ChatArea } from './chat-area'
import type { LeadWithLastInteraction } from './types'
import type { Interaction } from '@/lib/supabase/types'

interface InteracoesClientProps {
  leads: LeadWithLastInteraction[]
  initialMessages: Interaction[]
}

export function InteracoesClient({ leads, initialMessages }: InteracoesClientProps) {
  const [activeLeadId, setActiveLeadId] = useState<string | null>(
    leads.length > 0 ? leads[0].id : null
  )
  const [messages] = useState<Interaction[]>(initialMessages)

  const activeLead = leads.find(l => l.id === activeLeadId) ?? null

  return (
    <div className="flex flex-1 overflow-hidden">
      <LeadsSidebar
        leads={leads}
        activeLeadId={activeLeadId}
        onSelect={setActiveLeadId}
      />

      {activeLead ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatHeader lead={activeLead} />
          <ChatArea
            messages={messages.filter(m => m.lead_id === activeLeadId)}
            lead={activeLead}
            onSend={async (text) => {
              await fetch(`/api/leads/${activeLeadId}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
              })
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-50">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-sm">Selecione um lead para ver a conversa</p>
        </div>
      )}
    </div>
  )
}
