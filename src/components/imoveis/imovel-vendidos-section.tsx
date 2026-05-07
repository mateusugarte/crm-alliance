'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, User, Phone, Mail, Home, DollarSign, Building2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { Imovel, Venda } from '@/lib/supabase/types'

interface ImovelVendidosSectionProps {
  imoveis: Imovel[]
  vendas: Venda[]
  isAdm?: boolean
}

function VendaCard({ imovel, venda }: { imovel: Imovel; venda: Venda | undefined }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={9} />
              VENDIDO
            </span>
          </div>
          <h3 className="font-bold text-alliance-dark text-sm">{imovel.nome}</h3>
          {venda && (
            <p className="text-xs text-gray-500 mt-0.5">Comprador: <span className="font-semibold text-gray-700">{venda.comprador_nome}</span></p>
          )}
        </div>
        {venda && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg focus-visible:outline-none"
            aria-label={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>

      {/* Expandido: detalhes da venda */}
      {expanded && venda && (
        <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">

          {/* Comprador */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Comprador</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <User size={12} className="text-alliance-blue flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate">{venda.comprador_nome}</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <Phone size={12} className="text-alliance-blue flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate">{venda.comprador_telefone}</span>
              </div>
              {venda.comprador_email && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 col-span-2">
                  <Mail size={12} className="text-alliance-blue flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{venda.comprador_email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 col-span-2">
                <Home size={12} className="text-alliance-blue flex-shrink-0" />
                <span className="text-xs text-gray-700">{venda.unidade_comprada}</span>
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Condições de Pagamento</p>
            <div className="flex flex-col gap-1.5">
              {venda.tem_entrada && venda.valor_entrada && (
                <div className="flex items-center justify-between text-xs py-2 px-3 bg-gray-50 rounded-xl">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <DollarSign size={11} className="text-emerald-600" />
                    Entrada
                  </span>
                  <span className="font-semibold text-gray-800">{formatCurrency(venda.valor_entrada)}</span>
                </div>
              )}
              {venda.tem_financiamento && (
                <div className="flex items-center justify-between text-xs py-2 px-3 bg-gray-50 rounded-xl">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Building2 size={11} className="text-blue-600" />
                    Financiamento bancário
                    {venda.parcelas_financiamento && (
                      <span className="text-gray-400">({venda.parcelas_financiamento}x)</span>
                    )}
                  </span>
                  {venda.valor_financiado && (
                    <span className="font-semibold text-gray-800">{formatCurrency(venda.valor_financiado)}</span>
                  )}
                </div>
              )}
              {venda.tem_parcelamento_direto && (
                <div className="flex items-center justify-between text-xs py-2 px-3 bg-gray-50 rounded-xl">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <DollarSign size={11} className="text-amber-600" />
                    Parcelamento La Reserva
                    {venda.parcelas_direto && (
                      <span className="text-gray-400">({venda.parcelas_direto}x)</span>
                    )}
                  </span>
                  {venda.valor_parcela_direto && (
                    <span className="font-semibold text-gray-800">{formatCurrency(venda.valor_parcela_direto)}/mês</span>
                  )}
                </div>
              )}
              {!venda.tem_entrada && !venda.tem_financiamento && !venda.tem_parcelamento_direto && (
                <p className="text-xs text-gray-400">Condições não informadas.</p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-gray-300">
            Registrado em {new Date(venda.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  )
}

export function ImovelVendidosSection({ imoveis, vendas, isAdm }: ImovelVendidosSectionProps) {
  if (imoveis.length === 0) return null

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <h2 className="text-base font-bold text-alliance-dark">Imóveis Vendidos</h2>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {imoveis.length}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {imoveis.map((imovel) => {
          const venda = vendas.find(v => v.imovel_id === imovel.id)
          return (
            <VendaCard key={imovel.id} imovel={imovel} venda={venda} />
          )
        })}
      </div>
    </div>
  )
}
