'use client'

import { useState, useRef, useEffect } from 'react'
import { BedDouble, Bath, Maximize, Pencil, Trash2, Layers, DollarSign, MoreHorizontal, ArrowLeftRight, GripVertical } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Imovel } from '@/lib/supabase/types'

export interface ImovelCardProps {
  imovel: Imovel
  isAdm?: boolean
  onToggle?: (id: string) => void
  onEdit?: (imovel: Imovel) => void
  onDelete?: (id: string) => void
  onRegistrarVenda?: (imovel: Imovel) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
}

export function ImovelCard({
  imovel,
  isAdm = false,
  onToggle,
  onEdit,
  onDelete,
  onRegistrarVenda,
  dragHandleProps,
  isDragging = false,
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
    <div className={cn(
      'bg-white rounded-xl border border-gray-100 flex overflow-hidden transition-shadow',
      isDragging ? 'shadow-xl ring-2 ring-alliance-blue/20' : 'shadow-sm hover:shadow-md'
    )}>
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-6 bg-gray-50 border-r border-gray-100 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <GripVertical size={13} className="text-gray-300" />
        </div>
      )}

      {/* Status bar — left side */}
      <div className={cn('w-1 flex-shrink-0', imovel.disponivel ? 'bg-emerald-400' : 'bg-amber-400')} />

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
        {/* Header: nome + badge + menu */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-alliance-dark text-sm leading-tight truncate">{imovel.nome}</h3>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Layers size={9} className="text-gray-300 flex-shrink-0" />
              <span className="text-[10px] text-gray-400">
                {imovel.pavimento === 9 ? 'Cobertura' : `${imovel.pavimento}° Pav.`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap',
              imovel.disponivel
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            )}>
              {imovel.disponivel ? 'Disponível' : 'Reservado'}
            </span>

            {isAdm && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className={cn(
                    'p-0.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none',
                    menuOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                  )}
                >
                  <MoreHorizontal size={13} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44">
                    {onToggle && (
                      <button
                        onClick={() => { onToggle(imovel.id); setMenuOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left',
                          imovel.disponivel ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
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
                        Editar
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
        <div className="flex items-center gap-1">
          <Maximize size={11} className="text-alliance-blue flex-shrink-0" />
          <span className="text-sm font-bold text-alliance-blue">
            {imovel.metragem.toLocaleString('pt-BR')} m²
          </span>
        </div>

        {/* Quartos / suítes */}
        <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <BedDouble size={11} className="text-gray-400" />
            {imovel.quartos} qts
          </span>
          <span className="w-px h-2.5 bg-gray-200" />
          <span className="flex items-center gap-1">
            <Bath size={11} className="text-gray-400" />
            {imovel.suites} suítes
          </span>
        </div>

        {/* Valor */}
        <div className="pt-1.5 border-t border-gray-50">
          <span className="text-[11px] font-semibold text-gray-600">
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
    </div>
  )
}
