'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { staggerItem, cardHover } from '@/lib/animations'

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
      {...cardHover}
      className={`rounded-2xl p-5 flex flex-col gap-2 ${
        variant === 'featured'
          ? 'bg-alliance-dark text-white'
          : 'bg-alliance-card text-alliance-dark'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${variant === 'featured' ? 'text-white/80' : 'text-gray-500'}`}>
          {label}
        </span>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <span className="text-4xl font-bold">{count}</span>
    </motion.div>
  )
}
