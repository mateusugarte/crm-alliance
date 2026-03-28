'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageBubble } from './message-bubble'
import type { LeadWithLastInteraction } from './types'
import type { Interaction } from '@/lib/supabase/types'

interface ChatAreaProps {
  messages: Interaction[]
  lead: LeadWithLastInteraction
  onSend?: (text: string) => Promise<void>
  loading?: boolean
}

/** Formata a chave de data para agrupamento (yyyy-MM-dd) */
function toDateKey(isoString: string): string {
  return isoString.slice(0, 10)
}

/** Retorna o rótulo legível para o separador de data */
function formatDateLabel(isoDateKey: string): string {
  const date = new Date(isoDateKey + 'T12:00:00')
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, 'dd MMM', { locale: ptBR })
}

/** Agrupa um array de Interaction por data (yyyy-MM-dd) */
function groupMessagesByDate(messages: Interaction[]): Array<{ dateKey: string; messages: Interaction[] }> {
  const map = new Map<string, Interaction[]>()
  for (const msg of messages) {
    const key = toDateKey(msg.created_at)
    const group = map.get(key) ?? []
    group.push(msg)
    map.set(key, group)
  }
  return Array.from(map.entries()).map(([dateKey, msgs]) => ({ dateKey, messages: msgs }))
}

export function ChatArea({ messages, lead, onSend, loading }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

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

  const groups = groupMessagesByDate(messages)
  // Quando há consultor atribuído, exibir o nome do lead como remetente das mensagens outbound
  const consultantName = lead.assigned_to !== null ? lead.name : undefined

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-alliance-chat">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-body">Carregando historico...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-card flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="text-gray-400"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-body text-gray-500">Nenhuma mensagem ainda</p>
            <p className="text-caption text-gray-400">As mensagens aparecerao aqui em tempo real</p>
          </div>
        )}

        {!loading && groups.map(({ dateKey, messages: groupMsgs }) => (
          <div key={dateKey} className="flex flex-col gap-3">
            {/* Separador de data */}
            <div className="text-caption text-gray-400 text-center py-2">
              {formatDateLabel(dateKey)}
            </div>
            {groupMsgs.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isIA={lead.assigned_to === null}
                consultantName={consultantName}
              />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input — so quando automacao pausada */}
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
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-body outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue/30 focus-visible:border-alliance-blue transition disabled:opacity-60 cursor-text"
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
