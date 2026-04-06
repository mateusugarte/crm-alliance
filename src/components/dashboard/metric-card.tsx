'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { staggerItem } from '@/lib/animations'

interface MetricCardProps {
  label: string
  value: number
  variant?: 'featured' | 'default' | 'wide'
  icon?: React.ReactNode
  accentColor?: string
  trend?: number
  className?: string
}

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = performance.now()
    const frame = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [target, duration])

  return count
}

function TrendBadge({ trend }: { trend: number }) {
  const positive = trend >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      positive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400'
    }`}>
      {positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {positive ? '+' : ''}{trend}%
    </span>
  )
}

export function MetricCard({ label, value, variant = 'default', icon, accentColor = '#1E90FF', trend, className }: MetricCardProps) {
  const count = useCountUp(value)

  if (variant === 'featured') {
    return (
      <motion.div
        variants={staggerItem}
        className={`rounded-2xl px-6 py-5 flex flex-col gap-3 relative overflow-hidden ${className ?? ''}`}
        style={{ background: 'linear-gradient(135deg, #071f7a 0%, #0A2EAD 50%, #1565C0 100%)' }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        {/* Glow */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex items-start justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {label}
          </span>
          {icon && (
            <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white/80 flex-shrink-0">
              {icon}
            </span>
          )}
        </div>
        <div className="relative flex items-end gap-3">
          <span className="text-[3rem] font-bold tabular-nums leading-none text-white">
            {count}
          </span>
          {trend !== undefined && <TrendBadge trend={trend} />}
        </div>
      </motion.div>
    )
  }

  if (variant === 'wide') {
    return (
      <motion.div
        variants={staggerItem}
        className={`rounded-2xl bg-white dark:bg-white/5 flex items-center gap-5 px-6 py-4 relative overflow-hidden ${className ?? ''}`}
        style={{ boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.04)' }}
      >
        <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: accentColor + '15', color: accentColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40 block mb-0.5">
            {label}
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold tabular-nums" style={{ color: accentColor }}>
              {count}
            </span>
            {trend !== undefined && <TrendBadge trend={trend} />}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={staggerItem}
      className={`rounded-2xl bg-white dark:bg-white/5 flex flex-col gap-1.5 relative overflow-hidden ${className ?? ''}`}
      style={{ boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.04)' }}
    >
      {/* Colored top accent bar */}
      <div className="h-[3px] w-full rounded-t-2xl" style={{ backgroundColor: accentColor }} />

      <div className="px-5 pb-4 pt-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40 leading-tight">
            {label}
          </span>
          {icon && (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor + '18', color: accentColor }}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2.5">
          <span
            className="text-[2.5rem] font-bold tabular-nums leading-none text-gray-900 dark:text-white"
          >
            {count}
          </span>
          {trend !== undefined && <TrendBadge trend={trend} />}
        </div>
      </div>
    </motion.div>
  )
}
