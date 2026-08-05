import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, User } from '@/lib/icons'
import type { Interaction } from '@/lib/supabase/types'
import { extractMessageText } from '@/lib/whatsapp/extract-message-text'

interface MessageBubbleProps {
  message: Interaction
  consultantName?: string
}

export function MessageBubble({ message, consultantName }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })
  const isInbound = message.direction === 'inbound'
  const isBot = message.sender_type === 'bot'
  // Defesa para linhas antigas gravadas com o payload cru do WhatsApp
  const text = extractMessageText(message.content)

  if (isInbound) {
    return (
      <div className="flex justify-start items-end gap-2">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-surface border border-line mb-5">
          <User size={13} className="text-ink-subtle" />
        </div>
        <div className="max-w-[70%] flex flex-col gap-0.5">
          {/* Superfície elevada, não afundada: o fundo da conversa já é
              `surface-sunken` e a bolha some se usar o mesmo valor. */}
          <div className="px-4 py-2.5 rounded-[var(--radius-panel)] rounded-bl-sm text-sm leading-relaxed bg-surface text-ink elev-xs">
            {text}
          </div>
          <span className="text-2xs text-ink-subtle pl-1">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end items-end gap-2">
      <div className="max-w-[70%] flex flex-col items-end gap-0.5">
        {isBot ? (
          <div
            className="px-4 py-2.5 rounded-[var(--radius-panel)] rounded-br-sm text-sm leading-relaxed text-white"
            style={{ background: 'var(--brand)' }}
          >
            {text}
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-[var(--radius-panel)] rounded-br-sm text-sm leading-relaxed bg-surface elev-sm dark:shadow-none text-ink border border-line">
            {text}
          </div>
        )}
        <div className="flex items-center gap-2 pr-1">
          {isBot ? (
            <span className="inline-flex items-center gap-1 text-alliance-blue text-2xs font-medium">
              <Bot size={9} /> IA
            </span>
          ) : (
            <span className="text-2xs text-ink-subtle font-medium">
              {consultantName ?? 'Consultor'}
            </span>
          )}
          <span className="text-2xs text-ink-subtle">{time}</span>
        </div>
      </div>

      {isBot ? (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-5"
          style={{ background: 'var(--brand)' }}
        >
          <Bot size={13} className="text-white" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-5 bg-surface-sunken">
          <User size={13} className="text-ink-subtle" />
        </div>
      )}
    </div>
  )
}
