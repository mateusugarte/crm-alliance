'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { LeadsSidebar } from './leads-sidebar'
import { ChatHeader } from './chat-header'
import { ChatArea } from './chat-area'
import { createClient } from '@/lib/supabase/client'
import type { LeadWithLastInteraction, LeadContact } from './types'
import type { Interaction } from '@/lib/supabase/types'

function playNotificationBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch { /* silencia autoplay policy */ }
}

interface InteracoesClientProps {
  conversations: LeadWithLastInteraction[]
  contacts: LeadContact[]
  initialMessages: Interaction[]
}

export function InteracoesClient({ conversations: initialConversations, contacts, initialMessages }: InteracoesClientProps) {
  const [conversations, setConversations] = useState<LeadWithLastInteraction[]>(initialConversations)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(
    initialConversations.length > 0 ? initialConversations[0].id : null
  )
  const [messages, setMessages] = useState<Interaction[]>(initialMessages)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Ref para acesso ao valor atual dentro do closure da subscription
  const activeLeadIdRef = useRef<string | null>(activeLeadId)
  const allLeadIdsRef = useRef(new Set([
    ...initialConversations.map(l => l.id),
    ...contacts.map(l => l.id),
  ]))
  useEffect(() => { activeLeadIdRef.current = activeLeadId }, [activeLeadId])

  // Supabase Realtime — escuta INSERTs na tabela interactions
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('interactions-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interactions' },
        (payload) => {
          const msg = payload.new as Interaction
          if (!allLeadIdsRef.current.has(msg.lead_id)) return

          // Adiciona mensagem ao estado
          setMessages(prev => [...prev, msg])

          // Move conversa para o topo com prévia atualizada
          setConversations(prev => {
            const idx = prev.findIndex(l => l.id === msg.lead_id)
            if (idx < 0) return prev
            const updated = { ...prev[idx], lastMessage: msg.content, lastMessageAt: msg.created_at }
            return [updated, ...prev.filter(l => l.id !== msg.lead_id)]
          })

          // Som + badge apenas para mensagens inbound fora da conversa ativa
          if (msg.direction === 'inbound' && msg.lead_id !== activeLeadIdRef.current) {
            playNotificationBeep()
            setUnreadCounts(prev => ({ ...prev, [msg.lead_id]: (prev[msg.lead_id] ?? 0) + 1 }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSelectLead = (id: string) => {
    setActiveLeadId(id)
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }))
  }

  const handleSend = async (text: string) => {
    if (!activeLeadId) return

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

    // Move conversa para o topo ao enviar
    setConversations(prev => {
      const idx = prev.findIndex(l => l.id === activeLeadId)
      if (idx < 0) return prev
      const updated = { ...prev[idx], lastMessage: text, lastMessageAt: new Date().toISOString() }
      return [updated, ...prev.filter(l => l.id !== activeLeadId)]
    })

    try {
      const res = await fetch(`/api/leads/${activeLeadId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      toast.error('Erro ao enviar mensagem. Tente novamente.')
    }
  }

  // Busca lead ativo tanto nas conversas quanto nos contatos
  const activeLead =
    conversations.find(l => l.id === activeLeadId) ??
    (contacts.find(l => l.id === activeLeadId)
      ? { ...(contacts.find(l => l.id === activeLeadId)!), lastMessage: null, lastMessageAt: null }
      : null)

  return (
    <div className="flex flex-1 overflow-hidden">
      <LeadsSidebar
        conversations={conversations}
        contacts={contacts}
        activeLeadId={activeLeadId}
        onSelect={handleSelectLead}
        unreadCounts={unreadCounts}
      />

      {activeLead ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatHeader lead={activeLead} />
          <ChatArea
            messages={messages
              .filter(m => m.lead_id === activeLeadId)
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            }
            lead={activeLead}
            onSend={handleSend}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center gap-4"
          style={{ background: '#0A0C10' }}
        >
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white/30">Nenhuma conversa selecionada</p>
            <p className="text-xs text-white/15 mt-1">Escolha um lead na lista ao lado</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
