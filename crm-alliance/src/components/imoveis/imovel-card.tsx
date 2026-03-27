'use client'

import { motion } from 'framer-motion'
import { BedDouble, Bath, CheckCircle, XCircle } from 'lucide-react'
import { staggerItem } from '@/lib/animations'
import { formatCurrency } from '@/lib/utils/format'
import type { ImovelMock } from './imovel-data'

interface ImovelCardProps {
  imovel: ImovelMock
}

export function ImovelCard({ imovel }: ImovelCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-alliance-dark text-lg leading-tight">{imovel.nome}</h3>
        {imovel.disponivel ? (
          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
            <CheckCircle size={12} /> Disponível
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
            <XCircle size={12} /> Vendido
          </span>
        )}
      </div>

      {/* Metragem */}
      <div className="text-3xl font-bold text-alliance-blue">
        {imovel.metragem.toLocaleString('pt-BR')} m²
      </div>

      {/* Quartos e suítes */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <BedDouble size={16} className="text-alliance-dark" />
          {imovel.quartos} quartos
        </span>
        <span className="flex items-center gap-1">
          <Bath size={16} className="text-alliance-dark" />
          {imovel.suites} suítes
        </span>
      </div>

      {/* Diferenciais */}
      <ul className="flex flex-col gap-1">
        {imovel.diferenciais.map((d) => (
          <li key={d} className="text-xs text-gray-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-alliance-blue inline-block flex-shrink-0" />
            {d}
          </li>
        ))}
      </ul>

      {/* Valor */}
      <div className="mt-auto pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400 block mb-0.5">Faixa de valor</span>
        <span className="font-semibold text-alliance-dark text-sm">
          {formatCurrency(imovel.valor_min)} – {formatCurrency(imovel.valor_max)}
        </span>
      </div>
    </motion.div>
  )
}
