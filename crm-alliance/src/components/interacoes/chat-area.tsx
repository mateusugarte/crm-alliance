'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageBubble } from './message-bubble'
import type { LeadWithLastInteraction } from './types'
import type { Interaction } from '@/lib/supabase/types'

interface ChatAreaProps {
  messages: Interaction[]
  lead: LeadWithLastInteraction
  onSend?: (text: string) => Promise<void>
  // Wave F — indicador de carregamento do historico via GET /api/interactions/[leadId]
  loading?: boolean
}

export function ChatArea({ messages, lead, onSend, loading }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // Scroll para ultima mensagem ao abrir o chat (lead.id muda) e ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, lead.id])

  const handleSend = async () => {
    if (!input.trim() || !onSend || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      await onSend(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#CCCCCC]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
        {/* Wave F — skeleton de carregamento do historico */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando historico...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-gray-400 text-xs">As mensagens aparecerao aqui em tempo real</p>
          </div>
        )}

        {!loading && messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isIA={lead.assigned_to === null}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input — so quando automacao pausada, com AnimatePresence */}
      <AnimatePresence>
        {lead.automation_paused && (
          <motion.div
            key="chat-input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="px-6 py-4 bg-white border-t border-gray-100 flex-shrink-0"
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escreva uma mensagem..."
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue/30 focus-visible:border-alliance-blue transition disabled:opacity-60 cursor-text"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                aria-label="Enviar mensagem"
                className="w-10 h-10 bg-alliance-blue text-white rounded-full flex items-center justify-center hover:bg-alliance-dark disabled:opacity-40 transition-colors flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
