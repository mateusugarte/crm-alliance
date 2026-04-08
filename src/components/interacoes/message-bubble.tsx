import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, User } from 'lucide-react'
import type { Interaction } from '@/lib/supabase/types'

interface MessageBubbleProps {
  message: Interaction
  isIA: boolean
  consultantName?: string
}

export function MessageBubble({ message, isIA, consultantName }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })
  const isInbound = message.direction === 'inbound'
  const isBot = message.sender_type === 'bot'

  if (isInbound) {
    return (
      <div className="flex justify-start items-end gap-2 group">
        {/* Avatar do lead */}
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white/70 mb-5"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <User size={13} />
        </div>
        <div className="max-w-[70%] flex flex-col gap-0.5">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {message.content}
          </div>
          <span className="text-[10px] text-white/25 pl-1">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end items-end gap-2 group">
      <div className="max-w-[70%] flex flex-col items-end gap-0.5">
        {isBot ? (
          <div
            className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed text-white/90"
            style={{
              background: 'linear-gradient(135deg, rgba(10,46,173,0.7) 0%, rgba(30,144,255,0.5) 100%)',
              border: '1px solid rgba(30,144,255,0.2)',
            }}
          >
            {message.content}
          </div>
        ) : (
          <div
            className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed text-white/90"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {message.content}
          </div>
        )}
        <div className="flex items-center gap-2 pr-1">
          {isBot ? (
            <span className="inline-flex items-center gap-1 text-alliance-blue/60 text-[10px] font-medium">
              <Bot size={9} /> IA
            </span>
          ) : (
            <span className="text-[10px] text-white/25 font-medium">{consultantName ?? 'Consultor'}</span>
          )}
          <span className="text-[10px] text-white/20">{time}</span>
        </div>
      </div>

      {/* Avatar do remetente */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-5"
        style={{
          background: isBot
            ? 'linear-gradient(135deg, #0A2EAD 0%, #1E90FF 100%)'
            : 'rgba(255,255,255,0.15)',
        }}
      >
        {isBot
          ? <Bot size={13} className="text-white" />
          : <User size={13} className="text-white/70" />
        }
      </div>
    </div>
  )
}
