'use client'

import { motion } from 'framer-motion'
import { BedDouble, Bath, Maximize, Pencil, Trash2, Layers, DollarSign } from 'lucide-react'
import { staggerItem } from '@/lib/animations'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Imovel } from '@/lib/supabase/types'

interface ImovelCardProps {
  imovel: Imovel
  isAdm?: boolean
  onToggle?: (id: string) => void
  onEdit?: (imovel: Imovel) => void
  onDelete?: (id: string) => void
  onRegistrarVenda?: (imovel: Imovel) => void
}

export function ImovelCard({
  imovel,
  isAdm = false,
  onToggle,
  onEdit,
  onDelete,
  onRegistrarVenda,
}: ImovelCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden"
    >
      {/* Barra de status: verde = disponível, âmbar = reservado */}
      <div className={cn('h-1.5 w-full', imovel.disponivel ? 'bg-emerald-500' : 'bg-amber-400')} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header: nome + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-alliance-dark text-sm leading-tight">{imovel.nome}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Layers size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-400">
                {imovel.pavimento === 9 ? 'Cobertura' : `${imovel.pavimento}° Pav.`}
              </span>
            </div>
          </div>
          <span className={cn(
            'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0',
            imovel.disponivel
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          )}>
            {imovel.disponivel ? 'Disponível' : 'Reservado'}
          </span>
        </div>

        {/* Metragem */}
        <div className="flex items-center gap-1.5">
          <Maximize size={13} className="text-alliance-blue" />
          <span className="text-lg font-bold text-alliance-blue">
            {imovel.metragem.toLocaleString('pt-BR')} m²
          </span>
        </div>

        {/* Quartos e suítes */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <BedDouble size={12} className="text-alliance-dark" />
            {imovel.quartos} qts
          </span>
          <span className="w-px h-3 bg-gray-200" />
          <span className="flex items-center gap-1">
            <Bath size={12} className="text-alliance-dark" />
            {imovel.suites} suítes
          </span>
        </div>

        {/* Valor */}
        <div className="pt-2 border-t border-gray-100 mt-auto">
          <span className="text-xs font-semibold text-alliance-dark">
            {imovel.valor_min != null && imovel.valor_max != null
              ? `${formatCurrency(imovel.valor_min)} – ${formatCurrency(imovel.valor_max)}`
              : imovel.valor_min != null
                ? `A partir de ${formatCurrency(imovel.valor_min)}`
                : imovel.valor_max != null
                  ? `Até ${formatCurrency(imovel.valor_max)}`
                  : 'Consulte o corretor'}
          </span>
        </div>

        {/* Ações ADM — sempre visíveis */}
        {isAdm && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
            {/* Toggle disponibilidade */}
            {onToggle && (
              <button
                onClick={() => onToggle(imovel.id)}
                className={cn(
                  'flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none border',
                  imovel.disponivel
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                )}
              >
                {imovel.disponivel ? 'Marcar Reservado' : 'Marcar Disponível'}
              </button>
            )}
            {/* Registrar venda */}
            {onRegistrarVenda && (
              <button
                onClick={() => onRegistrarVenda(imovel)}
                title="Registrar venda"
                className="flex items-center gap-1 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg bg-alliance-dark text-white hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none"
              >
                <DollarSign size={11} />
                Venda
              </button>
            )}
            {/* Editar */}
            {onEdit && (
              <button
                onClick={() => onEdit(imovel)}
                title="Editar"
                className="p-1.5 text-gray-400 hover:text-alliance-blue transition-colors cursor-pointer rounded-lg focus-visible:outline-none"
              >
                <Pencil size={13} />
              </button>
            )}
            {/* Excluir */}
            {onDelete && (
              <button
                onClick={() => onDelete(imovel.id)}
                title="Excluir"
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer rounded-lg focus-visible:outline-none"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
