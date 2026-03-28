'use client'

import { motion } from 'framer-motion'
import { BedDouble, Bath, Eye, EyeOff, Maximize } from 'lucide-react'
import { staggerItem } from '@/lib/animations'
import { formatCurrency } from '@/lib/utils/format'
import type { ImovelMock } from './imovel-data'

interface ImovelCardProps {
  imovel: ImovelMock
  isAdm?: boolean
  onToggle?: (id: string) => void
}

export function ImovelCard({ imovel, isAdm = false, onToggle }: ImovelCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      // shadow-card delimita o card — borda redundante removida (itens 6)
      className="bg-white rounded-2xl shadow-card flex flex-col overflow-hidden"
    >
      {/* Topo colorido — indicador de disponibilidade */}
      <div className={`h-2 w-full ${imovel.disponivel ? 'bg-alliance-blue' : 'bg-gray-300'}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          {/* Título do card: text-subtitle semântico */}
          <h3 className="text-subtitle text-alliance-dark leading-tight">{imovel.nome}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {imovel.disponivel ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                <Eye size={11} /> Disponível
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                <EyeOff size={11} /> Indisponível
              </span>
            )}
            {isAdm && onToggle && (
              <button
                onClick={() => onToggle(imovel.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                title={imovel.disponivel ? 'Marcar indisponível' : 'Marcar disponível'}
              >
                {imovel.disponivel
                  ? <EyeOff size={14} />
                  : <Eye size={14} />
                }
              </button>
            )}
          </div>
        </div>

        {/* Metragem destaque */}
        <div className="flex items-center gap-2">
          <Maximize size={16} className="text-alliance-blue" />
          {/* tabular-nums: dígitos de largura fixa para valores numéricos */}
          <span className="text-2xl font-bold text-alliance-blue tabular-nums">
            {imovel.metragem.toLocaleString('pt-BR')} m²
          </span>
        </div>

        {/* Quartos e suítes: text-body semântico */}
        <div className="flex items-center gap-4 text-body text-gray-600">
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

        {/* Diferenciais: text-caption semântico */}
        <ul className="flex flex-col gap-1.5">
          {imovel.diferenciais.map((d) => (
            <li key={d} className="text-caption text-gray-500 flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-alliance-blue inline-block flex-shrink-0 mt-1" />
              {d}
            </li>
          ))}
        </ul>

        {/* Valor */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          {/* Label de seção: text-label semântico */}
          <span className="text-label text-gray-400 block mb-1 uppercase tracking-widest">
            Faixa de valor
          </span>
          {/* tabular-nums para valores monetários */}
          <span className="font-bold text-alliance-dark text-sm tabular-nums">
            {formatCurrency(imovel.valor_min)} – {formatCurrency(imovel.valor_max)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
