'use client'
import { motion } from 'framer-motion'

interface AllianceBadgeProps {
  label: string
  color: string
  variant?: 'default' | 'small'
}

export default function AllianceBadge({ label, color, variant = 'default' }: AllianceBadgeProps) {
  return (
    <motion.span
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={`inline-flex items-center rounded-full font-medium text-white ${
        variant === 'small' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
      style={{ backgroundColor: color }}
    >
      {label}
    </motion.span>
  )
}
