'use client'

import { motion } from 'framer-motion'
import { Users, Calendar, MessageSquareOff, Flame, PauseCircle, Home } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
import { MetricCard } from './metric-card'

interface MetricsData {
  total_leads: number
  reunioes: number
  sem_resposta: number
  aquecidos: number
  pausadas: number
  disponiveis: number
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
      className="flex flex-col gap-3"
    >
      {/* Linha 1+2: Featured (2 rows) + 4 cards */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: 'auto auto' }}
      >
        {/* Featured — span 2 rows */}
        <div style={{ gridRow: 'span 2' }}>
          <MetricCard
            label="Total de Leads"
            value={metrics.total_leads}
            variant="featured"
            icon={<Users size={14} />}
            className="h-full"
          />
        </div>

        <MetricCard
          label="Reuniões Hoje"
          value={metrics.reunioes}
          icon={<Calendar size={14} />}
          accentColor="var(--color-stage-follow-up)"
        />
        <MetricCard
          label="Leads Quentes"
          value={metrics.aquecidos}
          icon={<Flame size={14} />}
          accentColor="var(--color-stage-quente)"
        />

        <MetricCard
          label="Sem Resposta"
          value={metrics.sem_resposta}
          icon={<MessageSquareOff size={14} />}
          accentColor="var(--color-feedback-error)"
        />
        <MetricCard
          label="Pausados"
          value={metrics.pausadas}
          icon={<PauseCircle size={14} />}
          accentColor="var(--color-feedback-warning)"
        />
      </div>

      {/* Linha 3: full width */}
      <MetricCard
        label="Disponíveis — visita ou reunião agendada"
        value={metrics.disponiveis}
        variant="wide"
        icon={<Home size={14} />}
        accentColor="var(--color-stage-reuniao)"
      />
    </motion.div>
  )
}
