'use client'

import { motion } from 'framer-motion'
import {
  Calendar, Flame, Gauge, Home, MessageSquareOff, PauseCircle,
  Snowflake, ThermometerSun, Users, Zap, ICON,
} from '@/lib/icons'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { MetricCard, MetricCardFeatured, MetricDivider, MetricInline } from './metric-card'

/**
 * Grade de métricas.
 *
 * Antes: dez cartões na primeira dobra — um destaque, quatro pequenos, um
 * largo e mais quatro de score — todos com o mesmo peso visual. Dez números
 * com a mesma voz equivalem a nenhum: nada dizia o que olhar primeiro.
 *
 * Agora, três níveis explícitos:
 *   1. Três KPIs em cartão — o que decide o dia do corretor.
 *   2. Uma faixa com os números de acompanhamento.
 *   3. Uma faixa com os scores por temperatura.
 *
 * Mesmos dez números, um terço dos elementos, hierarquia legível.
 */

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

function percentOf(part: number, total: number) {
  if (!total) return undefined
  const value = (part / total) * 100
  if (value > 0 && value < 1) return '<1% da base'
  return `${Math.round(value)}% da base`
}

const STRIP =
  'flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface elev-sm sm:flex-row sm:divide-y-0'

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const total = metrics.total_leads

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-4"
    >
      {/* 1 — os três números que decidem o dia */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCardFeatured
          label="Total de leads"
          value={total}
          hint="Base completa, sem filtro de período"
          icon={<Users size={ICON.md} />}
        />
        <MetricCard
          label="Leads quentes"
          value={metrics.aquecidos}
          hint={percentOf(metrics.aquecidos, total)}
          icon={<Flame size={ICON.md} />}
          accentColor="var(--stage-quente)"
        />
        <MetricCard
          label="Reuniões"
          value={metrics.reunioes}
          hint={percentOf(metrics.reunioes, total)}
          icon={<Calendar size={ICON.md} />}
          accentColor="var(--stage-reuniao)"
        />
      </div>

      {/* 2 — acompanhamento. Uma superfície, três números. */}
      <motion.div variants={staggerItem} className={STRIP}>
        <MetricInline
          label="Sem resposta"
          value={metrics.sem_resposta}
          hint={percentOf(metrics.sem_resposta, total)}
          icon={<MessageSquareOff size={ICON.md} />}
          accentColor="var(--stage-nao-respondeu)"
        />
        <MetricDivider />
        <MetricInline
          label="Automação pausada"
          value={metrics.pausadas}
          icon={<PauseCircle size={ICON.md} />}
          accentColor="var(--warning)"
        />
        <MetricDivider />
        <MetricInline
          label="Leads pós-reunião"
          value={metrics.disponiveis}
          icon={<Home size={ICON.md} />}
          accentColor="var(--stage-visita)"
        />
      </motion.div>

      {/* 3 — score por temperatura. Quatro valores, uma faixa. */}
      <motion.div variants={staggerItem} className={STRIP}>
        <MetricInline
          label="Score médio global"
          value={metrics.score_medio}
          decimals={1}
          suffix=" / 10"
          icon={<Gauge size={ICON.md} />}
          accentColor="var(--brand-accent)"
        />
        <MetricDivider />
        <MetricInline
          label="Score dos frios"
          value={metrics.score_medio_frio}
          decimals={1}
          suffix=" / 10"
          icon={<Snowflake size={ICON.md} />}
          accentColor="var(--stage-frio)"
        />
        <MetricDivider />
        <MetricInline
          label="Score dos mornos"
          value={metrics.score_medio_morno}
          decimals={1}
          suffix=" / 10"
          icon={<ThermometerSun size={ICON.md} />}
          accentColor="var(--stage-morno)"
        />
        <MetricDivider />
        <MetricInline
          label="Score dos quentes"
          value={metrics.score_medio_quente}
          decimals={1}
          suffix=" / 10"
          icon={<Zap size={ICON.md} />}
          accentColor="var(--stage-quente)"
        />
      </motion.div>
    </motion.div>
  )
}
