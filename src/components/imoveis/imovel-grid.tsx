'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { staggerContainer } from '@/lib/animations'
import { ImovelCard } from './imovel-card'
import type { ImovelMock } from './imovel-data'

interface ImovelGridProps {
  imoveis: ImovelMock[]
  isAdm?: boolean
}

export function ImovelGrid({ imoveis: initialImoveis, isAdm = false }: ImovelGridProps) {
  const [imoveis, setImoveis] = useState(initialImoveis)

  const handleToggle = async (id: string) => {
    const imovel = imoveis.find(i => i.id === id)
    if (!imovel) return

    const newState = !imovel.disponivel
    setImoveis(prev => prev.map(i => i.id === id ? { ...i, disponivel: newState } : i))

    try {
      const res = await fetch(`/api/imoveis/${id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'Imóvel marcado como disponível' : 'Imóvel marcado como indisponível')
    } catch {
      setImoveis(prev => prev.map(i => i.id === id ? { ...i, disponivel: imovel.disponivel } : i))
      toast.error('Erro ao atualizar disponibilidade.')
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {imoveis.map((imovel) => (
        <ImovelCard
          key={imovel.id}
          imovel={imovel}
          isAdm={isAdm}
          onToggle={handleToggle}
        />
      ))}
    </motion.div>
  )
}
