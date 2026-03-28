'use client'

import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

interface ErrorStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
}

export function ErrorState({
  title = 'Erro ao carregar dados',
  description = 'Nao foi possivel conectar ao servidor. Verifique sua conexao e tente novamente.',
  action,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold text-gray-700">{title}</p>
        <p className="text-sm text-gray-400 max-w-xs">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  )
}
