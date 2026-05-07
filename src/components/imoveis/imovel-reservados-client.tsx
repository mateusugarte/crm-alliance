'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, FileText, DollarSign, BedDouble, Bath, Maximize } from 'lucide-react'
import { ImovelVendaForm } from './imovel-venda-form'
import { formatCurrency } from '@/lib/utils/format'
import type { Imovel, Venda } from '@/lib/supabase/types'

interface Props {
  imoveis: Imovel[]
  vendas: Venda[]
  isAdm: boolean
}

export function ImovelReservadosClient({ imoveis: initial, vendas: initialVendas, isAdm }: Props) {
  const [imoveis, setImoveis] = useState<Imovel[]>(initial)
  const [vendas, setVendas] = useState<Venda[]>(initialVendas)
  const [vendaImovel, setVendaImovel] = useState<Imovel | null>(null)

  const handleVendaSaved = (venda: Venda, imovelId: string) => {
    setImoveis(prev => prev.filter(i => i.id !== imovelId))
    setVendas(prev => [venda, ...prev])
    setVendaImovel(null)
    toast.success('Venda registrada! Imóvel movido para a seção de vendidos.')
  }

  if (imoveis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <Clock size={22} className="text-amber-500" />
        </div>
        <p className="font-semibold text-alliance-dark text-sm">Nenhum imóvel reservado</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Unidades marcadas como indisponíveis sem venda formalizada aparecem aqui.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {imoveis.map(imovel => (
          <ReservadoCard
            key={imovel.id}
            imovel={imovel}
            isAdm={isAdm}
            onRegistrarVenda={isAdm ? setVendaImovel : undefined}
          />
        ))}
      </div>

      <ImovelVendaForm
        imovel={vendaImovel}
        imoveis={imoveis}
        onClose={() => setVendaImovel(null)}
        onSaved={handleVendaSaved}
      />
    </>
  )
}

function ReservadoCard({
  imovel,
  isAdm,
  onRegistrarVenda,
}: {
  imovel: Imovel
  isAdm: boolean
  onRegistrarVenda?: (imovel: Imovel) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-amber-200/70 shadow-sm overflow-hidden">
      {/* Barra âmbar */}
      <div className="h-1 w-full bg-amber-400" />

      <div className="px-5 py-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full mb-1">
              <Clock size={9} />
              RESERVADO
            </span>
            <h3 className="font-bold text-alliance-dark text-sm leading-tight">{imovel.nome}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {imovel.pavimento === 9 ? 'Cobertura' : `${imovel.pavimento}° Pavimento`}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold text-alliance-dark">
              {imovel.valor_min != null
                ? `${formatCurrency(imovel.valor_min)}`
                : '—'}
            </p>
            {imovel.valor_min != null && (
              <p className="text-[10px] text-gray-400">a partir de</p>
            )}
          </div>
        </div>

        {/* Specs */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Maximize size={11} className="text-alliance-blue" />
            {imovel.metragem} m²
          </span>
          <span className="w-px h-3 bg-gray-200" />
          <span className="flex items-center gap-1">
            <BedDouble size={11} className="text-alliance-dark" />
            {imovel.quartos} qts
          </span>
          <span className="w-px h-3 bg-gray-200" />
          <span className="flex items-center gap-1">
            <Bath size={11} className="text-alliance-dark" />
            {imovel.suites} suítes
          </span>
        </div>

        {/* Estado: sem ficha */}
        <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
          <FileText size={14} className="text-gray-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">Sem ficha de comprador</p>
            <p className="text-[11px] text-gray-400">Venda não formalizada</p>
          </div>
        </div>

        {/* Ação ADM */}
        {isAdm && onRegistrarVenda && (
          <button
            onClick={() => onRegistrarVenda(imovel)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-alliance-dark text-white rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none"
          >
            <DollarSign size={12} />
            Registrar Venda
          </button>
        )}
      </div>
    </div>
  )
}
