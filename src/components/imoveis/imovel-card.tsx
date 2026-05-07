'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BedDouble, Bath, Maximize, Pencil, Trash2, Layers, DollarSign, MoreHorizontal, ArrowLeftRight } from 'lucide-react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <motion.div
      variants={staggerItem}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col relative"
    >
      {/* Barra de status */}
      <div className={cn('h-1 w-full rounded-t-2xl', imovel.disponivel ? 'bg-emerald-500' : 'bg-amber-400')} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-alliance-dark text-sm leading-tight">{imovel.nome}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Layers size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-400">
                {imovel.pavimento === 9 ? 'Cobertura' : `${imovel.pavimento}° Pav.`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={cn(
              'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
              imovel.disponivel
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            )}>
              {imovel.disponivel ? 'Disponível' : 'Reservado'}
            </span>

            {/* ADM: menu de ações */}
            {isAdm && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className={cn(
                    'p-1 rounded-lg transition-colors cursor-pointer focus-visible:outline-none',
                    menuOpen
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  )}
                  aria-label="Ações"
                >
                  <MoreHorizontal size={14} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44">
                    {onToggle && (
                      <button
                        onClick={() => { onToggle(imovel.id); setMenuOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left',
                          imovel.disponivel
                            ? 'text-amber-700 hover:bg-amber-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        )}
                      >
                        <ArrowLeftRight size={12} />
                        {imovel.disponivel ? 'Marcar Reservado' : 'Marcar Disponível'}
                      </button>
                    )}
                    {onRegistrarVenda && (
                      <button
                        onClick={() => { onRegistrarVenda(imovel); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-alliance-dark hover:bg-gray-50 transition-colors cursor-pointer text-left"
                      >
                        <DollarSign size={12} />
                        Registrar venda
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => { onEdit(imovel); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                      >
                        <Pencil size={12} />
                        Editar imóvel
                      </button>
                    )}
                    {onDelete && (
                      <>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                          onClick={() => { onDelete(imovel.id); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer text-left"
                        >
                          <Trash2 size={12} />
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
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
      </div>
    </motion.div>
  )
}
