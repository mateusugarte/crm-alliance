'use client'

import { useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, Loader2, Send } from '@/lib/icons'
import type { Interaction } from './types'
import { extractMessageText } from '@/lib/whatsapp/extract-message-text'

interface LeadChatSectionProps {
  interactions: Interaction[]
  fetchingInteractions: boolean
  newMessage: string
  sendingMessage: boolean
  displayName: string
  onNewMessageChange: (msg: string) => void
  onSend: () => void
}

export function LeadChatSection({
  interactions,
  fetchingInteractions,
  newMessage,
  sendingMessage,
  displayName,
  onNewMessageChange,
  onSend,
}: LeadChatSectionProps) {
  const chatBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const chatBody = chatBodyRef.current
    if (!chatBody || interactions.length === 0) return
    chatBody.scrollTop = chatBody.scrollHeight
  }, [interactions])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/[0.06]" style={{ backgroundColor: '#f2f2f4' }}>
      {/* Chat body */}
      <div ref={chatBodyRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        {fetchingInteractions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        ) : interactions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-gray-400">Nenhuma conversa registrada ainda.</p>
          </div>
        ) : (
          interactions.map((msg) => {
            const isLeft = msg.sender_type === 'lead'
            const time = format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })

            const bubbleStyle = {
              lead:     'bg-white rounded-bl-sm',
              bot:      'bg-[#DCF8C6] rounded-br-sm',
              corretor: 'bg-[#D0E8FF] rounded-br-sm',
            }[msg.sender_type]

            const labelStyle = {
              lead:     'text-gray-500',
              bot:      'text-emerald-700',
              corretor: 'text-alliance-blue',
            }[msg.sender_type]

            const senderLabel = {
              lead:     displayName,
              bot:      msg.sender_name ?? 'IA Alliance',
              corretor: msg.sender_name ?? 'Corretor',
            }[msg.sender_type]

            return (
              <div
                key={msg.id}
                className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`relative max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${bubbleStyle}`}>
                  <div className={`flex items-center gap-1 mb-0.5 ${labelStyle}`}>
                    {msg.sender_type === 'bot' && (
                      <Bot size={10} className="flex-shrink-0" />
                    )}
                    <p className="text-[10px] font-bold leading-none">{senderLabel}</p>
                  </div>
                  <p className="text-sm text-gray-800 leading-snug whitespace-pre-wrap break-words pr-8">
                    {extractMessageText(msg.content)}
                  </p>
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-400 leading-none">
                    {time}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-black/[0.06] bg-white/75 px-3 py-2.5 backdrop-blur-xl">
        <textarea
          value={newMessage}
          onChange={e => onNewMessageChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="max-h-24 flex-1 resize-none overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-alliance-blue/20"
          style={{ lineHeight: '1.4' }}
        />
        <button
          onClick={onSend}
          disabled={!newMessage.trim() || sendingMessage}
          className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gray-950 text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          aria-label="Enviar mensagem"
        >
          {sendingMessage
            ? <Loader2 size={15} className="animate-spin" />
            : <Send size={15} />
          }
        </button>
      </div>
    </div>
  )
}
