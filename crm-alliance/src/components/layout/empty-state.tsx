'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center"
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-alliance-blue/[0.06] flex items-center justify-center text-alliance-blue">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold text-gray-700">{title}</p>
        {description && (
          <p className="text-sm text-gray-400 max-w-xs">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  )
}
