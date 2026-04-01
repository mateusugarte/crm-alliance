'use client'

import { motion } from 'framer-motion'
import { BedDouble, Bath, Eye, EyeOff, Maximize, Pencil, Trash2 } from 'lucide-react'
import { staggerItem } from '@/lib/animations'
import { formatCurrency } from '@/lib/utils/format'
import type { Imovel } from '@/lib/supabase/types'

interface ImovelCardProps {
  imovel: Imovel
  isAdm?: boolean
  onToggle?: (id: string) => void
  onEdit?: (imovel: Imovel) => void
  onDelete?: (id: string) => void
}

export function ImovelCard({ imovel, isAdm = false, onToggle, onEdit, onDelete }: ImovelCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden"
    >
      {/* Topo colorido */}
      <div className={`h-2 w-full ${imovel.disponivel ? 'bg-alliance-blue' : 'bg-gray-300'}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-alliance-dark text-base leading-tight">{imovel.nome}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer focus-visible:outline-none"
                title={imovel.disponivel ? 'Marcar indisponível' : 'Marcar disponível'}
              >
                {imovel.disponivel ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            {isAdm && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <button
                    onClick={() => onEdit(imovel)}
                    className="text-gray-400 hover:text-alliance-blue transition-colors p-0.5 cursor-pointer focus-visible:outline-none"
                    title="Editar imóvel"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(imovel.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer focus-visible:outline-none"
                    title="Excluir imóvel"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
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
            {imovel.valor_min != null && imovel.valor_max != null
              ? `${formatCurrency(imovel.valor_min)} – ${formatCurrency(imovel.valor_max)}`
              : imovel.valor_min != null
                ? `A partir de ${formatCurrency(imovel.valor_min)}`
                : imovel.valor_max != null
                  ? `Até ${formatCurrency(imovel.valor_max)}`
                  : 'Consulte o corretor'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
