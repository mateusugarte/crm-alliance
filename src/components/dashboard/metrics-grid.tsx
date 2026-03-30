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
      <MetricCard
        label="Total de Leads"
        value={metrics.leads}
        variant="featured"
        icon={<Users size={16} />}
      />
      <MetricCard
        label="Reuniões Hoje"
        value={metrics.reunioes}
        icon={<Calendar size={16} />}
        accent="#9B59B6"
      />
      <MetricCard
        label="Sem Resposta"
        value={metrics.sem_resposta}
        icon={<MessageSquareOff size={16} />}
        accent="#EF4444"
      />
      <MetricCard
        label="Leads Quentes"
        value={metrics.aquecidos}
        icon={<Flame size={16} />}
        accent="#FF4500"
      />
      <MetricCard
        label="Pausados"
        value={metrics.pausadas}
        icon={<PauseCircle size={16} />}
        accent="#F59E0B"
      />
      <MetricCard
        label="Disponíveis"
        value={metrics.disponiveis}
        variant="featured"
        icon={<Home size={16} />}
      />
    </motion.div>
  )
}
