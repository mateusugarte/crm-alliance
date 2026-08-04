'use client'

import { useState, useRef, useEffect } from 'react'
import { BedDouble, Bath, Maximize, Pencil, Trash2, Layers, DollarSign, MoreHorizontal, ArrowLeftRight, GripVertical } from '@/lib/icons'
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
      'flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-ui',
      isDragging ? 'elev-lg ring-2 ring-ring/30' : 'elev-xs hover:border-line-strong hover:elev-md',
    )}>
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-6 bg-surface-sunken border-r border-line cursor-grab active:cursor-grabbing hover:bg-surface-sunken transition-colors flex-shrink-0"
        >
          <GripVertical size={13} className="text-ink-subtle" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
        {/* Cabeçalho.
            A faixa vertical de 4px à esquerda saiu: duplicava o badge
            "Disponível"/"Reservado" que já estava ao lado. O nome ganhou a
            linha inteira — antes o badge o espremia até virar "Apt…". */}
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight text-ink">
            {imovel.nome}
          </h3>

          <div className="flex items-center gap-1 flex-shrink-0">
            {(isAdm || onToggle) && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className={cn(
                    'p-0.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none',
                    menuOpen ? 'bg-surface-sunken text-ink' : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink-muted'
                  )}
                >
                  <MoreHorizontal size={13} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface rounded-xl elev-md border border-line py-1 w-44">
                    {onToggle && (
                      <button
                        onClick={() => { onToggle(imovel.id); setMenuOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left',
                          imovel.disponivel ? 'text-[var(--warning-ink)] hover:bg-[var(--warning-soft)]' : 'text-[var(--success-ink)] hover:bg-[var(--success-soft)]'
                        )}
                      >
                        <ArrowLeftRight size={12} />
                        {imovel.disponivel ? 'Marcar Reservado' : 'Marcar Disponível'}
                      </button>
                    )}
                    {isAdm && onRegistrarVenda && (
                      <button
                        onClick={() => { onRegistrarVenda(imovel); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <DollarSign size={12} />
                        Registrar venda
                      </button>
                    )}
                    {isAdm && onEdit && (
                      <button
                        onClick={() => { onEdit(imovel); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                    )}
                    {isAdm && onDelete && (
                      <>
                        <div className="h-px bg-surface-sunken my-1" />
                        <button
                          onClick={() => { onDelete(imovel.id); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--danger-ink)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer text-left"
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

        {/* Status e pavimento — o badge desceu para cá, onde tem espaço */}
        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-2xs font-medium leading-none',
              imovel.disponivel
                ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                : 'bg-[var(--warning-soft)] text-[var(--warning-ink)]',
            )}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: imovel.disponivel ? 'var(--success)' : 'var(--warning)' }}
            />
            {imovel.disponivel ? 'Disponível' : 'Reservado'}
          </span>
          <span className="inline-flex items-center gap-1 text-2xs text-ink-subtle">
            <Layers size={11} className="flex-shrink-0" />
            {imovel.pavimento === 9 ? 'Cobertura' : `${imovel.pavimento}º pav.`}
          </span>
        </div>

        {/* Metragem, quartos e suítes */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
            <Maximize size={12} className="flex-shrink-0 text-ink-subtle" />
            {imovel.metragem.toLocaleString('pt-BR')} m²
          </span>
          <span className="flex items-center gap-1">
            <BedDouble size={12} className="text-ink-subtle" />
            {imovel.quartos} qts
          </span>
          <span className="flex items-center gap-1">
            <Bath size={12} className="text-ink-subtle" />
            {imovel.suites} suítes
          </span>
        </div>

        {/* Valor */}
        <div className="pt-1.5 border-t border-line">
          <span className="text-xs font-semibold text-ink">
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
