'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { staggerItem } from '@/lib/animations'

interface MetricCardProps {
  label: string
  value: number
  variant?: 'featured' | 'default'
  icon?: React.ReactNode
  accent?: string
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

export function MetricCard({ label, value, variant = 'default', icon, accent = '#1E90FF' }: MetricCardProps) {
  const count = useCountUp(value)

  if (variant === 'featured') {
    return (
      <motion.div
        variants={staggerItem}
        className="rounded-2xl px-6 py-5 flex flex-col gap-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A2EAD 0%, #1565C0 100%)' }}
      >
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
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
        <span className="relative text-[2.75rem] font-bold tabular-nums leading-none text-white">
          {count}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={staggerItem}
      className="rounded-2xl bg-white flex flex-col gap-2 relative overflow-hidden"
      style={{
        boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.04)',
      }}
    >
      {/* Colored top accent bar */}
      <div className="h-[3px] w-full rounded-t-2xl" style={{ backgroundColor: accent }} />

      <div className="px-5 pb-5 pt-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 leading-tight">
            {label}
          </span>
          {icon && (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accent + '15', color: accent }}
            >
              {icon}
            </span>
          )}
        </div>
        <span
          className="text-[2.75rem] font-bold tabular-nums leading-none"
          style={{ color: accent === '#1E90FF' ? '#0A2EAD' : '#111827' }}
        >
          {count}
        </span>
      </div>
    </motion.div>
  )
}
