'use client'

import { motion } from 'framer-motion'
import { BedDouble, Bath, CheckCircle, XCircle, Maximize } from 'lucide-react'
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
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden"
    >
      {/* Topo colorido */}
      <div className={`h-2 w-full ${imovel.disponivel ? 'bg-alliance-blue' : 'bg-gray-300'}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-alliance-dark text-base leading-tight">{imovel.nome}</h3>
          {imovel.disponivel ? (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 border border-green-200 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              <CheckCircle size={11} /> Disponível
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-500 border border-red-200 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              <XCircle size={11} /> Vendido
            </span>
          )}
        </div>

        {/* Metragem destaque */}
        <div className="flex items-center gap-2">
          <Maximize size={16} className="text-alliance-blue" />
          <span className="text-2xl font-bold text-alliance-blue">
            {imovel.metragem.toLocaleString('pt-BR')} m²
          </span>
        </div>

        {/* Quartos e suítes */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <BedDouble size={15} className="text-alliance-dark" />
            {imovel.quartos} quartos
          </span>
          <span className="w-px h-4 bg-gray-200" />
          <span className="flex items-center gap-1.5">
            <Bath size={15} className="text-alliance-dark" />
            {imovel.suites} suítes
          </span>
        </div>

        {/* Diferenciais */}
        <ul className="flex flex-col gap-1.5">
          {imovel.diferenciais.map((d) => (
            <li key={d} className="text-xs text-gray-500 flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-alliance-blue inline-block flex-shrink-0 mt-1" />
              {d}
            </li>
          ))}
        </ul>

        {/* Valor */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400 block mb-1 font-medium uppercase tracking-wider">
            Faixa de valor
          </span>
          <span className="font-bold text-alliance-dark text-sm">
            {formatCurrency(imovel.valor_min)} – {formatCurrency(imovel.valor_max)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
