'use client'

import { useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, Loader2, Send } from 'lucide-react'
import type { Interaction } from './types'

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
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (interactions.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [interactions])

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-100" style={{ backgroundColor: '#ECE5DD' }}>
      {/* Chat body */}
      <div className="flex flex-col gap-1.5 p-3 max-h-72 overflow-y-auto">
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
                <div className={`relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${bubbleStyle}`}>
                  <div className={`flex items-center gap-1 mb-0.5 ${labelStyle}`}>
                    {msg.sender_type === 'bot' && (
                      <Bot size={10} className="flex-shrink-0" />
                    )}
                    <p className="text-[10px] font-bold leading-none">{senderLabel}</p>
                  </div>
                  <p className="text-sm text-gray-800 leading-snug whitespace-pre-wrap break-words pr-8">
                    {msg.content}
                  </p>
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-400 leading-none">
                    {time}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2.5 bg-[#F0F0F0] border-t border-gray-200">
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
          className="flex-1 text-sm bg-white rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 border border-gray-200 leading-snug max-h-24 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
        />
        <button
          onClick={onSend}
          disabled={!newMessage.trim() || sendingMessage}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-alliance-dark text-white rounded-full hover:bg-alliance-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
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
