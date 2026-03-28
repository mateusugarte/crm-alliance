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
        // shadow-card substitui shadow-sm — usa token de elevação
        'rounded-2xl p-6 shadow-card',
        variant === 'featured'
          ? 'bg-alliance-dark text-white'
          : 'bg-alliance-card text-gray-800',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
