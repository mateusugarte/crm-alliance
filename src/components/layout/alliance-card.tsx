'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { cardHover } from '@/lib/animations'

interface AllianceCardProps {
  children: React.ReactNode
  variant?: 'default' | 'featured'
  className?: string
}

export default function AllianceCard({ children, variant = 'default', className }: AllianceCardProps) {
  return (
    <motion.div
      {...cardHover}
      className={cn(
        'rounded-[var(--radius-panel)] p-6 elev-sm',
        variant === 'featured'
          ? 'bg-alliance-dark text-white'
          : 'bg-alliance-card text-ink',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
