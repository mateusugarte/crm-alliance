'use client'

import { motion } from 'framer-motion'
import { staggerContainer } from '@/lib/animations'
import { ImovelCard } from './imovel-card'
import type { ImovelMock } from './imovel-data'

interface ImovelGridProps {
  imoveis: ImovelMock[]
}

export function ImovelGrid({ imoveis }: ImovelGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {imoveis.map((imovel) => (
        <ImovelCard key={imovel.id} imovel={imovel} />
      ))}
    </motion.div>
  )
}
