'use client'

import { motion } from 'framer-motion'
import { Users, Calendar, MessageSquareOff, Flame, PauseCircle, Home, Gauge, Snowflake, ThermometerSun, Zap } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
import { MetricCard } from './metric-card'

interface MetricsData {
  total_leads: number
  reunioes: number
  sem_resposta: number
  aquecidos: number
  pausadas: number
  disponiveis: number
  score_medio: number
  score_medio_frio: number
  score_medio_morno: number
  score_medio_quente: number
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
          label="Reuniões"
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

      {/* Linha 3: funil */}
      <MetricCard
        label="Leads pós-reunião"
        value={metrics.disponiveis}
        variant="wide"
        icon={<Home size={14} />}
        accentColor="var(--color-stage-reuniao)"
      />

      {/* Linha 4: score por temperatura */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Score médio global"
          value={metrics.score_medio}
          variant="wide"
          icon={<Gauge size={14} />}
          accentColor="#185FA5"
          decimals={1}
        />
        <MetricCard
          label="Score médio frio"
          value={metrics.score_medio_frio}
          variant="wide"
          icon={<Snowflake size={14} />}
          accentColor="var(--color-stage-frio)"
          decimals={1}
        />
        <MetricCard
          label="Score médio morno"
          value={metrics.score_medio_morno}
          variant="wide"
          icon={<ThermometerSun size={14} />}
          accentColor="var(--color-stage-morno)"
          decimals={1}
        />
        <MetricCard
          label="Score médio quente"
          value={metrics.score_medio_quente}
          variant="wide"
          icon={<Zap size={14} />}
          accentColor="var(--color-stage-quente)"
          decimals={1}
        />
      </div>
    </motion.div>
  )
}
