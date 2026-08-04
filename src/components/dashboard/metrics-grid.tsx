'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarCheck, Flame, MessageSquareOff, PauseCircle, PhoneCall, ICON,
} from '@/lib/icons'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface MetricsData {
  total_leads: number
  chegaram_reuniao: number
  follow_up: number
  sem_interesse: number
  vendas: number
  sem_resposta_contexto: number
  frios_sem_disparo: number
  aquecidos: number
  aguardando_primeiro_contato: number
  pausadas: number
}
interface MetricsGridProps {
  metrics: MetricsData
}

function ActionMetric({
  label,
  value,
  detail,
  icon,
  href,
  accent,
}: {
  label: string
  value: number
  detail: React.ReactNode
  icon: React.ReactNode
  href?: string
  accent: string
}) {
  const content = (
    <motion.div
      variants={staggerItem}
      className="group h-full rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm transition-ui hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-ink">{value.toLocaleString('pt-BR')}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)` }}>
          {icon}
        </span>
      </div>
      <div className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">{detail}</div>
    </motion.div>
  )

  return href ? <Link href={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : content
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <motion.section variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ActionMetric
          label="Quentes agora"
          value={metrics.aquecidos}
          detail="Abrir os leads prontos para contato"
          icon={<Flame size={ICON.md} />}
          href="/kanban?stage=lead_quente"
          accent="var(--stage-quente)"
        />
        <ActionMetric
          label="Aguardando 1º contato"
          value={metrics.aguardando_primeiro_contato}
          detail="Qualificados que ainda não têm ligação registrada"
          icon={<PhoneCall size={ICON.md} />}
          accent="var(--brand)"
        />
        <ActionMetric
          label="Chegaram à reunião"
          value={metrics.chegaram_reuniao}
          detail={
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{metrics.follow_up} pensando</span>
              <span>{metrics.sem_interesse} disseram não</span>
              <span>{metrics.vendas} compraram</span>
            </span>
          }
          icon={<CalendarCheck size={ICON.md} />}
          accent="var(--stage-reuniao)"
        />
      </div>

      <motion.div variants={staggerItem} className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface elev-sm sm:grid-cols-2">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:border-b-0 sm:border-r">
          <MessageSquareOff size={ICON.md} className="text-[var(--stage-frio)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">Frios sem nenhum disparo</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{metrics.frios_sem_disparo.toLocaleString('pt-BR')}</p>
          </div>
          <span className="text-2xs text-ink-subtle">{metrics.sem_resposta_contexto.toLocaleString('pt-BR')} sem interação</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-3.5">
          <PauseCircle size={ICON.md} className="text-warning" />
          <div>
            <p className="text-xs text-ink-muted">Automação pausada</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{metrics.pausadas.toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </motion.div>
    </motion.section>
  )
}
