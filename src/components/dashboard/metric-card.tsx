'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { TrendingDown, TrendingUp } from '@/lib/icons'
import { staggerItem } from '@/lib/animations'
import { cn } from '@/lib/utils'

/**
 * Cartões de métrica.
 *
 * O que mudou e por quê:
 *
 *  · A faixa de 2px no topo e o filete lateral colorido saíram. Uma barra
 *    colorida não diz ao usuário qual métrica ele está lendo — o rótulo diz.
 *    A cor agora vive onde é interpretável: no ícone.
 *
 *  · O eyebrow de 10px em maiúsculas com tracking largo virou rótulo de 13px.
 *    Além de repetido em todo card, 10px cinza sobre branco não passa em
 *    contraste, e "REUNIÕES" quebrava em duas linhas em telas estreitas.
 *
 *  · O card em destaque tinha altura de duas linhas com o número no rodapé e
 *    um vazio no meio. Agora tem altura própria e conteúdo assentado.
 */

interface MetricCardProps {
  label: string
  value: number
  /** Contexto abaixo do número: "18% dos impactados", "de 806 na base". */
  hint?: string
  icon?: ReactNode
  /** Cor de acento — token do sistema, não hex. */
  accentColor?: string
  trend?: number
  className?: string
  decimals?: number
  suffix?: string
}

function useCountUp(target: number, duration = 550, decimals = 0) {
  const reduced = useReducedMotion()
  const [count, setCount] = useState(target)

  useEffect(() => {
    if (reduced) { setCount(target); return }
    if (target === 0) { setCount(0); return }
    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = eased * target
      setCount(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next))
      if (progress < 1) raf = requestAnimationFrame(frame)
    }
    setCount(0)
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, decimals, reduced])

  return count
}

function formatValue(count: number, decimals: number) {
  return decimals > 0 ? count.toFixed(decimals).replace('.', ',') : count.toLocaleString('pt-BR')
}

function TrendBadge({ trend, onDark = false }: { trend: number; onDark?: boolean }) {
  const positive = trend >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
        onDark
          ? 'bg-white/15 text-white'
          : positive
            ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
            : 'bg-[var(--danger-soft)] text-[var(--danger-ink)]',
      )}
    >
      <Icon size={11} />
      {positive ? '+' : ''}{trend}%
    </span>
  )
}

/* -------------------------------------------------------------------------
   KPI — os números que importam na primeira dobra
   ---------------------------------------------------------------------- */

export function MetricCard({
  label, value, hint, icon, accentColor = 'var(--brand-accent)',
  trend, className, decimals = 0, suffix = '',
}: MetricCardProps) {
  const count = useCountUp(value, 550, decimals)

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-muted">{label}</span>
        {icon && (
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
              color: accentColor,
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink">
            {formatValue(count, decimals)}{suffix}
          </span>
          {trend !== undefined && <TrendBadge trend={trend} />}
        </div>
        {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------
   KPI de destaque — um só por tela, na cor da marca
   ---------------------------------------------------------------------- */

export function MetricCardFeatured({
  label, value, hint, icon, trend, className, decimals = 0, suffix = '',
}: MetricCardProps) {
  const count = useCountUp(value, 550, decimals)

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'relative flex flex-col justify-between gap-4 overflow-hidden rounded-[var(--radius-card)] p-5 elev-md',
        className,
      )}
      style={{ background: 'linear-gradient(150deg, var(--nav-from) 0%, var(--brand) 100%)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/[0.07] blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-white/70">{label}</span>
        {icon && (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/15 text-white/90">
            {icon}
          </span>
        )}
      </div>

      <div className="relative">
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-white">
            {formatValue(count, decimals)}{suffix}
          </span>
          {trend !== undefined && <TrendBadge trend={trend} onDark />}
        </div>
        {hint && <p className="mt-1.5 text-xs text-white/55">{hint}</p>}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------
   Métrica em faixa — números secundários lado a lado numa superfície só,
   em vez de um card por número
   ---------------------------------------------------------------------- */

export function MetricInline({
  label, value, icon, accentColor = 'var(--ink-muted)', decimals = 0, suffix = '', hint,
}: MetricCardProps) {
  const count = useCountUp(value, 550, decimals)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
      {icon && (
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <span className="block truncate text-xs text-ink-muted">{label}</span>
        <span className="text-lg font-semibold leading-tight tabular-nums text-ink">
          {formatValue(count, decimals)}{suffix}
        </span>
        {hint && <span className="ml-1.5 text-xs text-ink-subtle">{hint}</span>}
      </div>
    </div>
  )
}

/** Divisor entre métricas de uma mesma faixa. */
export function MetricDivider() {
  return <span aria-hidden className="my-3 hidden w-px flex-shrink-0 self-stretch bg-line sm:block" />
}
