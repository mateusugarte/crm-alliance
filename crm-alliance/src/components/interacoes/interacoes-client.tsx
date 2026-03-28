'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { LeadsSidebar } from './leads-sidebar'
import { ChatHeader } from './chat-header'
import { ChatArea } from './chat-area'
import { createClient } from '@/lib/supabase/client'
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
  // Wave H — pulsing dot quando nova mensagem chega via Realtime
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const activeLead = leads.find(l => l.id === activeLeadId) ?? null

  // Wave F — GET /api/interactions/[leadId] quando troca de lead
  const loadHistory = useCallback(async (leadId: string) => {
    // Verificar se já temos mensagens desse lead no estado
    const existing = messages.filter(m => m.lead_id === leadId)
    if (existing.length > 0) return

    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/interactions/${leadId}`)
      if (!res.ok) throw new Error('Erro ao carregar historico')
      const json = await res.json() as { data: Interaction[] }
      setMessages(prev => {
        // Remover placeholders desse lead e adicionar os dados reais
        const withoutLead = prev.filter(m => m.lead_id !== leadId)
        return [...withoutLead, ...json.data]
      })
    } catch {
      toast.error('Nao foi possivel carregar o historico completo')
    } finally {
      setLoadingHistory(false)
    }
  }, [messages])

  const handleSelectLead = useCallback((id: string) => {
    setActiveLeadId(id)
    setHasNewMessage(false)
    loadHistory(id)
  }, [loadHistory])

  // Wave F — Supabase Realtime no Chat (escopo por leadId)
  useEffect(() => {
    if (!activeLeadId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`interactions-${activeLeadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `lead_id=eq.${activeLeadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Interaction
          setMessages(prev => {
            // Evitar duplicatas (mensagem otimista vs Realtime)
            if (prev.some(m => m.id === newMsg.id)) return prev
            // Substituir mensagem otimista temp- se o conteudo bater
            const tempIndex = prev.findIndex(
              m => m.id.startsWith('temp-') && m.content === newMsg.content && m.direction === newMsg.direction
            )
            if (tempIndex !== -1) {
              const next = [...prev]
              next[tempIndex] = newMsg
              return next
            }
            return [...prev, newMsg]
          })
          // Wave H — pulsing dot apenas para mensagens inbound
          if (newMsg.direction === 'inbound') {
            setHasNewMessage(true)
            toast.info('Nova mensagem recebida', { duration: 2500 })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeLeadId])

  const handleSend = async (text: string) => {
    if (!activeLeadId) return

    try {
      const res = await fetch(`/api/leads/${activeLeadId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        toast.error(err.error ?? 'Erro ao enviar mensagem')
        return
      }

      // Adicionar mensagem otimisticamente — Realtime vai substituir com ID real
      const optimistic: Interaction = {
        id: `temp-${Date.now()}`,
        lead_id: activeLeadId,
        direction: 'outbound',
        content: text,
        wa_message_id: null,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimistic])
    } catch {
      toast.error('Erro ao enviar mensagem. Verifique a conexao.')
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <LeadsSidebar
        leads={leads}
        activeLeadId={activeLeadId}
        onSelect={handleSelectLead}
        hasNewMessage={hasNewMessage}
      />

      {activeLead ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatHeader lead={activeLead} />
          <ChatArea
            messages={messages.filter(m => m.lead_id === activeLeadId)}
            lead={activeLead}
            onSend={handleSend}
            loading={loadingHistory}
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
