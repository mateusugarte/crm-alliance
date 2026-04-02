'use client'

import { motion } from 'framer-motion'
import { Users, Calendar, MessageSquareOff, Flame, PauseCircle, Home } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
import { MetricCard } from './metric-card'

interface MetricsData {
  leads: number
  reunioes: number
  sem_resposta: number
  aquecidos: number
  pausadas: number
  disponiveis: number
  trend_leads?: number
  trend_reunioes?: number
}

interface MetricsGridProps {
  metrics: MetricsData
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto auto' }}
    >
      {/* Total de Leads — ocupa 2 linhas */}
      <div style={{ gridRow: '1 / 3', gridColumn: '1' }}>
        <MetricCard
          label="Total de Leads"
          value={metrics.leads}
          variant="featured"
          icon={<Users size={16} />}
          trend={metrics.trend_leads}
          className="h-full"
        />
      </div>

      {/* Row 1 — col 2 e 3 */}
      <MetricCard
        label="Reuniões Hoje"
        value={metrics.reunioes}
        icon={<Calendar size={16} />}
        accentColor="var(--color-stage-follow-up)"
        trend={metrics.trend_reunioes}
      />
      <MetricCard
        label="Leads Quentes"
        value={metrics.aquecidos}
        icon={<Flame size={16} />}
        accentColor="var(--color-stage-quente)"
      />

      {/* Row 2 — col 2 e 3 */}
      <MetricCard
        label="Sem Resposta"
        value={metrics.sem_resposta}
        icon={<MessageSquareOff size={16} />}
        accentColor="var(--color-feedback-error)"
      />
      <MetricCard
        label="Pausados"
        value={metrics.pausadas}
        icon={<PauseCircle size={16} />}
        accentColor="var(--color-feedback-warning)"
      />

      {/* Row 3 — full width */}
      <div style={{ gridColumn: '1 / 4' }}>
        <MetricCard
          label="Disponíveis — visita ou reunião agendada"
          value={metrics.disponiveis}
          variant="wide"
          icon={<Home size={16} />}
          accentColor="var(--color-stage-reuniao)"
        />
      </div>
    </motion.div>
  )
}
