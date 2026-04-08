'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Zap, PauseCircle } from 'lucide-react'
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
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd 'de' MMMM", { locale: ptBR })
}

function groupMessagesByDate(messages: Interaction[]) {
  const groups: { label: string; messages: Interaction[] }[] = []
  let currentLabel = ''

  for (const msg of messages) {
    const label = getDateLabel(msg.created_at)
    if (label !== currentLabel) {
      currentLabel = label
      groups.push({ label, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

export function ChatArea({ messages, lead, onSend }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, lead.id])

  useEffect(() => {
    setInput('')
    setIsSending(false)
  }, [lead.id])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || !onSend || isSending) return
    const text = input.trim()
    setInput('')
    setIsSending(true)
    try {
      await onSend(text)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  const groups = groupMessagesByDate(messages)
  const canSend = !!onSend

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: '#0A0C10' }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-3"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-white/30 text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="text-white/15 text-xs">As mensagens aparecerão aqui em tempo real</p>
          </motion.div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              {/* Date separator */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)' }}
                >
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>

              {group.messages.map((msg, i) => (
                <AnimatePresence key={msg.id} mode="popLayout">
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i < 5 ? 0 : 0 }}
                  >
                    <MessageBubble
                      message={msg}
                      isIA={lead.assigned_to === null}
                    />
                  </motion.div>
                </AnimatePresence>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Banner IA ativa */}
      <AnimatePresence>
        {!lead.automation_paused && (
          <motion.div
            key="ia-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div
              className="mx-4 mb-0 mt-0 px-4 py-2.5 rounded-t-xl flex items-center gap-2"
              style={{
                background: 'rgba(30,144,255,0.07)',
                border: '1px solid rgba(30,144,255,0.12)',
                borderBottom: 'none',
              }}
            >
              <Zap size={12} className="text-alliance-blue flex-shrink-0" />
              <p className="text-xs text-white/40">
                IA respondendo automaticamente. Pause a automação para enviar mensagens manuais.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {!canSend || !lead.automation_paused ? (
            <div className="flex-1 flex items-center gap-2 py-0.5">
              <PauseCircle size={14} className="text-white/20 flex-shrink-0" />
              <span className="text-sm text-white/20 select-none">
                Pause a IA para enviar mensagens
              </span>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!isSending) handleSend()
                }
              }}
              placeholder="Escreva uma mensagem... (Enter para enviar)"
              disabled={isSending}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed disabled:opacity-50"
              style={{ minHeight: '22px', maxHeight: '120px' }}
            />
          )}

          <button
            onClick={handleSend}
            disabled={!lead.automation_paused || !input.trim() || isSending}
            aria-label="Enviar mensagem"
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed"
            style={{
              background: lead.automation_paused && input.trim()
                ? 'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)'
                : 'rgba(255,255,255,0.06)',
            }}
          >
            {isSending
              ? <Loader2 size={14} className="animate-spin text-white/60" />
              : <Send size={14} className={lead.automation_paused && input.trim() ? 'text-white' : 'text-white/25'} />
            }
          </button>
        </div>
        <p className="text-[10px] text-white/15 mt-1.5 text-center">
          {lead.automation_paused ? 'Shift+Enter para nova linha' : 'Automação ativa'}
        </p>
      </div>
    </div>
  )
}
