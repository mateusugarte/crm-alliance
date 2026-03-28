'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { staggerItem } from '@/lib/animations'

interface MetricCardProps {
  label: string
  value: number
  variant?: 'featured' | 'default'
  icon?: React.ReactNode
  delta?: number
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return
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

export function MetricCard({ label, value, variant = 'default', icon, delta }: MetricCardProps) {
  const count = useCountUp(value)

  const isPositive = delta !== undefined && delta >= 0
  const deltaColor = isPositive ? 'text-emerald-500' : 'text-red-500'
  const deltaArrow = isPositive ? '↑' : '↓'
  const deltaAbs = delta !== undefined ? Math.abs(delta) : 0

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`rounded-2xl px-6 py-5 flex flex-col gap-3 ${
        variant === 'featured'
          ? 'bg-alliance-dark text-white'
          : 'bg-white text-alliance-dark shadow-card'
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Label: escala semântica text-label */}
        <span className={`text-label uppercase tracking-widest ${
          variant === 'featured' ? 'text-white/60' : 'text-gray-400'
        }`}>
          {label}
        </span>
        {icon && (
          <span className={variant === 'featured' ? 'text-alliance-blue' : 'text-alliance-blue/60'}>
            {icon}
          </span>
        )}
      </div>

      {/* Valor principal — featured usa text-display, default usa text-4xl */}
      <span className={`font-bold tabular-nums ${
        variant === 'featured'
          ? 'text-display text-white'
          : 'text-4xl text-alliance-dark'
      }`}>
        {count}
      </span>

      {/* Delta percentual */}
      {delta !== undefined && (
        <span className={`text-caption ${deltaColor}`}>
          {deltaArrow} {deltaAbs}% vs. semana passada
        </span>
      )}
    </motion.div>
  )
}
