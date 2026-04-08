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
      <div className="flex justify-start items-end gap-2">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-white/8 mb-5">
          <User size={13} className="text-gray-400 dark:text-white/40" />
        </div>
        <div className="max-w-[70%] flex flex-col gap-0.5">
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-[#E8EAED] dark:bg-white/8 text-gray-800 dark:text-white/90">
            {message.content}
          </div>
          <span className="text-[10px] text-gray-400 dark:text-white/25 pl-1">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end items-end gap-2">
      <div className="max-w-[70%] flex flex-col items-end gap-0.5">
        {isBot ? (
          <div
            className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed text-white"
            style={{ background: 'linear-gradient(135deg, #0A2EAD 0%, #1E90FF 100%)' }}
          >
            {message.content}
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed bg-white dark:bg-white/10 shadow-sm dark:shadow-none text-gray-900 dark:text-white/90 border border-gray-100 dark:border-white/5">
            {message.content}
          </div>
        )}
        <div className="flex items-center gap-2 pr-1">
          {isBot ? (
            <span className="inline-flex items-center gap-1 text-alliance-blue text-[10px] font-medium">
              <Bot size={9} /> IA
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 dark:text-white/25 font-medium">
              {consultantName ?? 'Consultor'}
            </span>
          )}
          <span className="text-[10px] text-gray-300 dark:text-white/20">{time}</span>
        </div>
      </div>

      {isBot ? (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #0A2EAD 0%, #1E90FF 100%)' }}
        >
          <Bot size={13} className="text-white" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-5 bg-gray-100 dark:bg-white/10">
          <User size={13} className="text-gray-400 dark:text-white/50" />
        </div>
      )}
    </div>
  )
}
