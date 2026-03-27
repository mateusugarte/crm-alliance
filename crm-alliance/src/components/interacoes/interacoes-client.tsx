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
    <div className="flex h-full">
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
              // US-027 — send-message API route
              await fetch(`/api/leads/${activeLeadId}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
              })
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Selecione um lead para ver a conversa
        </div>
      )}
    </div>
  )
}
