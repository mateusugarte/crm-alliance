'use client'

import { useState } from 'react'
import { Loader2, X, DollarSign, User, Phone, Mail, Home, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils/format'
import type { Imovel, Venda } from '@/lib/supabase/types'

interface ImovelVendaFormProps {
  imovel: Imovel | null
  imoveis: Imovel[]
  onClose: () => void
  onSaved: (venda: Venda, imovelId: string) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue bg-white placeholder:text-gray-300'
const selectCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue bg-white appearance-none'

export function ImovelVendaForm({ imovel, imoveis, onClose, onSaved }: ImovelVendaFormProps) {
  const open = imovel !== null

  // Seleção de imóvel (caso aberto sem imóvel pré-selecionado)
  const [selectedImovelId, setSelectedImovelId] = useState<string>('')
  const targetImovel = imovel ?? imoveis.find(i => i.id === selectedImovelId) ?? null

  // Dados do comprador
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [unidade, setUnidade] = useState('')

  // Condições de pagamento
  const [temEntrada, setTemEntrada] = useState(false)
  const [valorEntrada, setValorEntrada] = useState('')
  const [temFinanciamento, setTemFinanciamento] = useState(false)
  const [valorFinanciado, setValorFinanciado] = useState('')
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState('')
  const [temParcelamentoDireto, setTemParcelamentoDireto] = useState(false)
  const [parcelasDireto, setParcelasDireto] = useState('')
  const [valorParcelaDireto, setValorParcelaDireto] = useState('')

  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setSelectedImovelId('')
    setNome('')
    setTelefone('')
    setEmail('')
    setUnidade('')
    setTemEntrada(false)
    setValorEntrada('')
    setTemFinanciamento(false)
    setValorFinanciado('')
    setParcelasFinanciamento('')
    setTemParcelamentoDireto(false)
    setParcelasDireto('')
    setValorParcelaDireto('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSave = async () => {
    if (!targetImovel) return
    if (!nome.trim() || !telefone.trim() || !unidade.trim()) {
      toast.error('Preencha nome, telefone e unidade comprada')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/imoveis/${targetImovel.id}/vender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comprador_nome: nome.trim(),
          comprador_telefone: telefone.trim(),
          comprador_email: email.trim() || null,
          unidade_comprada: unidade.trim(),
          tem_entrada: temEntrada,
          valor_entrada: temEntrada && valorEntrada ? parseFloat(valorEntrada.replace(',', '.')) : null,
          tem_financiamento: temFinanciamento,
          valor_financiado: temFinanciamento && valorFinanciado ? parseFloat(valorFinanciado.replace(',', '.')) : null,
          parcelas_financiamento: temFinanciamento && parcelasFinanciamento ? parseInt(parcelasFinanciamento) : null,
          tem_parcelamento_direto: temParcelamentoDireto,
          parcelas_direto: temParcelamentoDireto && parcelasDireto ? parseInt(parcelasDireto) : null,
          valor_parcela_direto: temParcelamentoDireto && valorParcelaDireto ? parseFloat(valorParcelaDireto.replace(',', '.')) : null,
        }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Venda }
      onSaved(json.data, targetImovel.id)
      resetForm()
    } catch {
      toast.error('Erro ao registrar venda')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 480, maxWidth: 480 }}
        className="p-0 overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0 bg-alliance-dark">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-white/70" />
                <span className="text-white/70 text-xs font-medium">Registrar Venda</span>
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">
                {targetImovel?.nome ?? 'Selecione o imóvel'}
              </h2>
              {targetImovel && (
                <p className="text-white/60 text-xs mt-0.5">
                  {targetImovel.valor_min != null
                    ? `A partir de ${formatCurrency(targetImovel.valor_min)}`
                    : 'Valor a confirmar'}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg cursor-pointer focus-visible:outline-none"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-5 flex-1">

          {/* Seleção de imóvel (quando não pré-selecionado) */}
          {!imovel && (
            <section>
              <SectionTitle>Imóvel</SectionTitle>
              <div className="relative">
                <select
                  value={selectedImovelId}
                  onChange={e => setSelectedImovelId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecione o imóvel vendido...</option>
                  {imoveis.map(im => (
                    <option key={im.id} value={im.id}>{im.nome}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </section>
          )}

          {/* Dados do comprador */}
          <section>
            <SectionTitle>Dados do Comprador</SectionTitle>
            <div className="flex flex-col gap-3">
              <Field label="Nome completo *">
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Nome do comprador"
                    className={inputCls + ' pl-9'}
                  />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone *">
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={telefone}
                      onChange={e => setTelefone(e.target.value)}
                      placeholder="(27) 99999-9999"
                      className={inputCls + ' pl-9'}
                    />
                  </div>
                </Field>
                <Field label="E-mail">
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className={inputCls + ' pl-9'}
                    />
                  </div>
                </Field>
              </div>
              <Field label="Unidade comprada *">
                <div className="relative">
                  <Home size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={unidade}
                    onChange={e => setUnidade(e.target.value)}
                    placeholder={targetImovel?.nome ?? 'Ex: Apartamento 301'}
                    className={inputCls + ' pl-9'}
                  />
                </div>
              </Field>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Condições de pagamento */}
          <section>
            <SectionTitle>Condições de Pagamento</SectionTitle>
            <div className="flex flex-col gap-4">

              {/* Entrada */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setTemEntrada(v => !v)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${temEntrada ? 'bg-alliance-dark' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${temEntrada ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Houve entrada?</span>
                </label>
                {temEntrada && (
                  <Field label="Valor da entrada">
                    <input
                      value={valorEntrada}
                      onChange={e => setValorEntrada(e.target.value)}
                      placeholder="Ex: 300000"
                      type="number"
                      min="0"
                      className={inputCls}
                    />
                  </Field>
                )}
              </div>

              {/* Financiamento bancário */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setTemFinanciamento(v => !v)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${temFinanciamento ? 'bg-alliance-dark' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${temFinanciamento ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Houve financiamento bancário?</span>
                </label>
                {temFinanciamento && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor financiado">
                      <input
                        value={valorFinanciado}
                        onChange={e => setValorFinanciado(e.target.value)}
                        placeholder="Ex: 1200000"
                        type="number"
                        min="0"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Nº de parcelas">
                      <input
                        value={parcelasFinanciamento}
                        onChange={e => setParcelasFinanciamento(e.target.value)}
                        placeholder="Ex: 360"
                        type="number"
                        min="1"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Parcelamento direto */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setTemParcelamentoDireto(v => !v)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${temParcelamentoDireto ? 'bg-alliance-dark' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${temParcelamentoDireto ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Parcelado com La Reserva?</span>
                </label>
                {temParcelamentoDireto && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nº de parcelas">
                      <input
                        value={parcelasDireto}
                        onChange={e => setParcelasDireto(e.target.value)}
                        placeholder="Ex: 60"
                        type="number"
                        min="1"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Valor da parcela">
                      <input
                        value={valorParcelaDireto}
                        onChange={e => setValorParcelaDireto(e.target.value)}
                        placeholder="Ex: 8500"
                        type="number"
                        min="0"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-100 mt-auto">
            <button
              onClick={handleClose}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !targetImovel || !nome.trim() || !telefone.trim() || !unidade.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-alliance-dark rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvando...' : 'Confirmar Venda'}
            </button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
