'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import BlobBottom from '@/components/layout/blob-bottom'

export default function SplashPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login')
    }, 2500)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-full overflow-hidden bg-white">
      {/* Logo */}
      <div className="absolute top-6 left-6">
        <span className="text-alliance-dark font-bold text-2xl tracking-tight">Alliance</span>
      </div>

      {/* Título principal */}
      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-3xl md:text-4xl font-bold text-alliance-blue uppercase tracking-widest text-center z-10 px-4"
      >
        Sistema de Gestão Inteligente
      </motion.h1>

      {/* Subtítulo */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        className="mt-4 text-alliance-blue/70 text-sm uppercase tracking-[0.3em] text-center z-10 px-4"
      >
        Gestão · Agente de IA · Pipeline · Agenda
      </motion.p>

      {/* Blob rodapé */}
      <BlobBottom />
    </div>
  )
}
