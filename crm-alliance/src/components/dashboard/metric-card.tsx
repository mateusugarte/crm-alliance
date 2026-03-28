'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { staggerItem } from '@/lib/animations'

interface MetricCardProps {
  label: string
  value: number
  variant?: 'featured' | 'default'
  icon?: React.ReactNode
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

export function MetricCard({ label, value, variant = 'default', icon }: MetricCardProps) {
  const count = useCountUp(value)

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`rounded-2xl px-6 py-5 flex flex-col gap-3 ${
        variant === 'featured'
          ? 'bg-alliance-dark text-white'
          : 'bg-white text-alliance-dark border border-gray-100 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${
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
      <span className={`text-4xl font-bold tabular-nums ${
        variant === 'featured' ? 'text-white' : 'text-alliance-dark'
      }`}>
        {count}
      </span>
    </motion.div>
  )
}
