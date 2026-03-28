'use client'

import { motion } from 'framer-motion'
import { Users, Calendar, MessageSquareOff, Flame, PauseCircle } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
import { MetricCard } from './metric-card'

interface MetricsData {
  leads: number
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
      className="grid grid-cols-3 gap-4"
    >
      {/* Linha 1: featured (col-span-2) + Reuniões Hoje (col-span-1) */}
      <div className="col-span-2">
        <MetricCard
          label="Total de Leads"
          value={metrics.leads}
          variant="featured"
          icon={<Users size={20} />}
          delta={8}
        />
      </div>
      <MetricCard
        label="Reuniões Hoje"
        value={metrics.reunioes}
        icon={<Calendar size={20} />}
        delta={2}
      />

      {/* Linha 2: 3 cards iguais */}
      <MetricCard
        label="Sem Resposta"
        value={metrics.sem_resposta}
        icon={<MessageSquareOff size={20} />}
        delta={-3}
      />
      <MetricCard
        label="Aquecidos"
        value={metrics.aquecidos}
        icon={<Flame size={20} />}
        delta={5}
      />
      <MetricCard
        label="Pausados"
        value={metrics.pausadas}
        icon={<PauseCircle size={20} />}
        delta={-1}
      />
    </motion.div>
  )
}
