'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
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
  const [messages, setMessages] = useState<Interaction[]>(initialMessages)

  const activeLead = leads.find(l => l.id === activeLeadId) ?? null

  const handleSend = async (text: string) => {
    if (!activeLeadId) return

    // Optimistic update — mensagem aparece imediatamente
    const optimisticMsg: Interaction = {
      id: crypto.randomUUID(),
      lead_id: activeLeadId,
      direction: 'outbound',
      sender_type: 'corretor',
      sender_name: null,
      content: text,
      created_at: new Date().toISOString(),
      wa_message_id: null,
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch(`/api/leads/${activeLeadId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Reverte o optimistic update em caso de erro
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      toast.error('Erro ao enviar mensagem. Tente novamente.')
    }
  }

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
            onSend={handleSend}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center gap-4 bg-alliance-col/40"
        >
          <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center text-alliance-blue/40">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-500">Nenhuma conversa selecionada</p>
            <p className="text-xs text-gray-400 mt-1">Escolha um lead na lista ao lado</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
