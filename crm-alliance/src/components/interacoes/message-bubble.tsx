import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot } from 'lucide-react'
import type { Interaction } from '@/lib/supabase/types'

interface MessageBubbleProps {
  message: Interaction
  isIA: boolean
  consultantName?: string
}

export function MessageBubble({ message, isIA, consultantName }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })
  const isInbound = message.direction === 'inbound'

  if (isInbound) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%]">
          <div className="bg-alliance-blue text-white rounded-r-2xl rounded-tl-2xl px-4 py-2.5 text-body leading-relaxed">
            {message.content}
          </div>
          {/* timestamp: text-caption semântico */}
          <span className="text-caption text-gray-400 mt-1 block pl-1">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] flex flex-col items-end gap-1">
        {/* shadow-card substitui shadow-sm */}
        <div className="bg-white rounded-l-2xl rounded-tr-2xl px-4 py-2.5 text-body shadow-card leading-relaxed text-alliance-dark">
          {message.content}
        </div>
        {isIA ? (
          <span className="inline-flex items-center gap-1 bg-alliance-dark text-white text-xs font-medium px-2 py-0.5 rounded-full">
            <Bot size={10} /> agente de IA
          </span>
        ) : (
          <span className="text-caption text-gray-500 font-medium">{consultantName ?? 'Consultor'}</span>
        )}
        <span className="text-caption text-gray-400">{time}</span>
      </div>
    </div>
  )
}
