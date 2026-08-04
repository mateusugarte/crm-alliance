'use client'

import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { Bot, Home, MapPin, Pause, PhoneCall, Send, ICON } from '@/lib/icons'
import { Chip } from '@/components/ui/chip'
import { scoreBandTokens } from '@/lib/stages'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/supabase/types'
import { formatPhone } from '@/lib/format-phone'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  isOverlay?: boolean
}

export const LeadCard = memo(function LeadCard({ lead, onClick, isOverlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  })

  const displayName = lead.name?.trim() || formatPhone(lead.phone) || 'Lead sem nome'
  const isBeforeAI = lead.antes_ia === true
  const aceitouConsultor = lead.aceitou_consultor === true
  const leadScore = Math.max(0, Math.min(100, lead.lead_score ?? 0))
  const scoreLabel = (leadScore / 10).toFixed(1).replace('.', ',')
  const scoreTokens = scoreBandTokens(lead.lead_score_band)
  const reactivations = lead.reactivation_count ?? 0

  // Placeholder que fica na coluna enquanto o DragOverlay segue o cursor
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        className="min-h-[84px] rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-surface/40"
      />
    )
  }

  return (
    <motion.div
      ref={isOverlay ? undefined : setNodeRef}
      style={
        isOverlay
          ? { rotate: '1.5deg', boxShadow: 'var(--elev-lg)', cursor: 'grabbing', pointerEvents: 'none' }
          : undefined
      }
      className={cn(
        'select-none rounded-[var(--radius-card)] border border-line bg-surface p-3 elev-xs',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        !isOverlay && 'cursor-pointer transition-ui hover:-translate-y-px hover:border-line-strong hover:elev-md active:cursor-grabbing',
      )}
      tabIndex={isOverlay ? -1 : 0}
      role={isOverlay ? undefined : 'button'}
      aria-label={isOverlay ? undefined : `Ver detalhes de ${displayName}`}
      onKeyDown={isOverlay ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      onClick={isOverlay ? undefined : (e) => {
        e.stopPropagation()
        onClick()
      }}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      {/* Nome + score. O estágio não se repete aqui — a coluna já diz qual é.
          Era isso que a faixa lateral colorida estava fazendo: nada. */}
      <div className="flex items-start justify-between gap-2.5">
        <span className="min-w-0 flex-1 overflow-hidden break-words text-base font-semibold leading-snug text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {displayName}
        </span>
        <span
          style={{ backgroundColor: scoreTokens.soft, color: scoreTokens.ink }}
          className="inline-flex h-6 min-w-9 flex-shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold leading-none tabular-nums"
          title={`Score do lead: ${scoreLabel} de 10`}
        >
          {scoreLabel}
        </span>
      </div>

      {/* Localização e imóvel de interesse */}
      {(lead.city || lead.imovel_interesse) && (
        <div className="mt-1.5 flex flex-col gap-1">
          {lead.city && (
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <MapPin size={ICON.xs} className="flex-shrink-0" />
              {lead.city}
            </span>
          )}
          {lead.imovel_interesse && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <Home size={ICON.xs} className="flex-shrink-0" />
              {lead.imovel_interesse}
            </span>
          )}
        </div>
      )}

      {/* Sinais do lead */}
      {(aceitouConsultor || isBeforeAI || lead.automation_paused || (lead.labels?.length ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {aceitouConsultor && (
            <Chip
              icon={PhoneCall}
              tokens={{ solid: 'var(--success)', soft: 'var(--success-soft)', ink: 'var(--success-ink)' }}
            >
              quer consultor
            </Chip>
          )}
          {lead.automation_paused && (
            <Chip
              icon={Pause}
              tokens={{ solid: 'var(--warning)', soft: 'var(--warning-soft)', ink: 'var(--warning-ink)' }}
            >
              pausado
            </Chip>
          )}
          {isBeforeAI && <Chip>antes da IA</Chip>}
          {lead.labels?.map(label => (
            <Chip
              key={label.id}
              tokens={{ solid: label.color, soft: `${label.color}1F`, ink: label.color }}
            >
              {label.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Rodapé: responsável + disparos de reativação */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
          {lead.assigned_to === null ? (
            <>
              <Bot size={ICON.xs} />
              agente de IA
            </>
          ) : (
            'Consultor'
          )}
        </span>
        {reactivations > 0 && (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1 text-xs tabular-nums text-ink-subtle"
            title={`${reactivations} disparo${reactivations > 1 ? 's' : ''} de reativação`}
          >
            <Send size={ICON.xs} />
            {reactivations}
          </span>
        )}
      </div>
    </motion.div>
  )
})
