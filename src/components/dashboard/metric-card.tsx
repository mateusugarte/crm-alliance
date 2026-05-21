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

function useCountUp(target: number, duration = 600) {
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
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
      positive
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
        : 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400'
    }`}>
      {positive ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {positive ? '+' : ''}{trend}%
    </span>
  )
}

export function MetricCard({
  label,
  value,
  variant = 'default',
  icon,
  accentColor = '#1E90FF',
  trend,
  className,
}: MetricCardProps) {
  const count = useCountUp(value)

  if (variant === 'featured') {
    return (
      <motion.div
        variants={staggerItem}
        className={`rounded-xl px-5 py-4 flex flex-col justify-between relative overflow-hidden ${className ?? ''}`}
        style={{ background: 'linear-gradient(150deg, #06195e 0%, #0A2EAD 55%, #1457c4 100%)' }}
      >
        {/* Subtle radial glow */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/[0.04] blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 leading-tight">
            {label}
          </span>
          {icon && (
            <span className="w-6 h-6 rounded-lg bg-white/[0.12] flex items-center justify-center text-white/60 flex-shrink-0">
              {icon}
            </span>
          )}
        </div>

        <div className="relative flex items-baseline gap-2 mt-3">
          <span className="text-[2rem] font-bold tabular-nums leading-none text-white">
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
        className={`rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] flex items-center gap-4 px-5 py-3 relative overflow-hidden ${className ?? ''}`}
      >
        <div
          className="w-[2px] self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: accentColor + '15', color: accentColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/35 block mb-0.5">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums" style={{ color: accentColor }}>
              {count}
            </span>
            {trend !== undefined && <TrendBadge trend={trend} />}
          </div>
        </div>
      </motion.div>
    )
  }

  // Default
  return (
    <motion.div
      variants={staggerItem}
      className={`rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] flex flex-col relative overflow-hidden ${className ?? ''}`}
    >
      {/* Top accent — 2px, minimal */}
      <div className="h-[2px] w-full rounded-t-xl" style={{ backgroundColor: accentColor }} />

      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/35 leading-tight">
            {label}
          </span>
          {icon && (
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor + '15', color: accentColor }}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
            {count}
          </span>
          {trend !== undefined && <TrendBadge trend={trend} />}
        </div>
      </div>
    </motion.div>
  )
}
