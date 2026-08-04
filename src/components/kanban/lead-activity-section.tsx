'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Activity, ArrowRight, CalendarCheck, Clock, Loader2,
  MessageSquare, PhoneCall, RotateCcw, ICON,
} from '@/lib/icons'
import { createClient } from '@/lib/supabase/client'
import type { LeadActivityItem } from '@/app/api/leads/[id]/activity/route'
import type { IconComponent } from '@/lib/icons'
import type { Json } from '@/lib/supabase/types'

const ACTIVITY_ICONS: Record<LeadActivityItem['type'], IconComponent> = {
  ligacao: PhoneCall,
  ligacao_desfeita: RotateCcw,
  reuniao_marcada: CalendarCheck,
  retorno_agendado: Clock,
  retentativa_agendada: Clock,
  mudanca_estagio: ArrowRight,
  comentario: MessageSquare,
  sistema: Activity,
}

function whenLabel(value: string) {
  const date = new Date(value)
  if (isToday(date)) return `hoje, ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `ontem, ${format(date, 'HH:mm')}`
  return format(date, "dd/MM 'as' HH:mm", { locale: ptBR })
}

function metadataStage(metadata: Json) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null
  const from = typeof metadata.from_stage === 'string' ? metadata.from_stage.replaceAll('_', ' ') : null
  const to = typeof metadata.to_stage === 'string' ? metadata.to_stage.replaceAll('_', ' ') : null
  return from && to ? `${from} para ${to}` : null
}

export function LeadActivitySection({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<LeadActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/activity`, { cache: 'no-store' })
      const json = await response.json() as { data?: LeadActivityItem[] }
      if (response.ok) setActivities(json.data ?? [])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [leadId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`lead-activity-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activity_events', filter: `lead_id=eq.${leadId}` }, () => { void load(true) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [leadId, load])

  if (loading) {
    return <div className="flex items-center gap-2 py-4 text-xs text-ink-subtle"><Loader2 size={ICON.xs} className="animate-spin" />Carregando historico...</div>
  }

  if (!activities.length) {
    return <p className="py-3 text-xs leading-relaxed text-ink-subtle">As proximas ligacoes, mudancas de etapa e anotacoes aparecerao aqui.</p>
  }

  return (
    <ol className="divide-y divide-black/[0.05]">
      {activities.map(item => {
        const Icon = ACTIVITY_ICONS[item.type]
        const stageChange = item.type === 'mudanca_estagio' ? metadataStage(item.metadata) : null
        return (
          <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
              <Icon size={ICON.xs} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-xs font-semibold text-ink">{item.title}</p>
                <time className="text-2xs text-ink-subtle">{whenLabel(item.createdAt)}</time>
              </div>
              {(item.description || stageChange) && <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{item.description || stageChange}</p>}
              {item.actorName && <p className="mt-1 text-2xs text-ink-subtle">{item.actorName}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
