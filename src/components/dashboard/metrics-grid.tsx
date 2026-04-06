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
      className="flex flex-col gap-4"
    >
      {/* Linha 1: Featured + 2 cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total de Leads — ocupa 2 linhas via row-span */}
        <div className="row-span-2">
          <MetricCard
            label="Total de Leads"
            value={metrics.leads}
            variant="featured"
            icon={<Users size={16} />}
            trend={metrics.trend_leads}
            className="h-full"
          />
        </div>

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

        {/* Linha 2: col 2 e 3 (col 1 está ocupada pelo featured) */}
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
      </div>

      {/* Linha 3: full width */}
      <MetricCard
        label="Disponíveis — visita ou reunião agendada"
        value={metrics.disponiveis}
        variant="wide"
        icon={<Home size={16} />}
        accentColor="var(--color-stage-reuniao)"
      />
    </motion.div>
  )
}
