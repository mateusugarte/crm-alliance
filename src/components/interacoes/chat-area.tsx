'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageBubble } from './message-bubble'
import type { LeadWithLastInteraction } from './types'
import type { Interaction } from '@/lib/supabase/types'

interface ChatAreaProps {
  messages: Interaction[]
  lead: LeadWithLastInteraction
  onSend?: (text: string) => void
}

export function ChatArea({ messages, lead, onSend }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  // Scroll automático ao abrir o chat (lead muda) e ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, lead.id])

  const handleSend = () => {
    if (!input.trim() || !onSend) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#F4F6F9' }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-gray-300 text-xs">As mensagens aparecerão aqui em tempo real</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isIA={lead.assigned_to === null}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input — só quando automação pausada, com AnimatePresence */}
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
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue/30 focus-visible:border-alliance-blue transition cursor-text"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
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
