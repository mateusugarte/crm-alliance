'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, X, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Imovel } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImovelFormPanelProps {
  open: boolean
  onClose: () => void
  imovel?: Imovel
  isAdm: boolean
  onSaved: (imovel: Imovel) => void
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800',
        'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue',
        'transition-colors bg-white',
        className,
      )}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImovelFormPanel({ open, onClose, imovel, isAdm, onSaved }: ImovelFormPanelProps) {
  const isEdit = imovel !== undefined

  // ── Form state ──
  const [nome, setNome] = useState('')
  const [metragem, setMetragem] = useState('')
  const [quartos, setQuartos] = useState('')
  const [suites, setSuites] = useState('')
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')
  const [diferenciais, setDiferenciais] = useState<string[]>([])
  const [disponivel, setDisponivel] = useState(true)
  const [novoD, setNovoD] = useState('')
  const [saving, setSaving] = useState(false)

  const novoDRef = useRef<HTMLInputElement>(null)

  // Populate fields when editing
  useEffect(() => {
    if (open && imovel) {
      setNome(imovel.nome)
      setMetragem(String(imovel.metragem))
      setQuartos(String(imovel.quartos))
      setSuites(String(imovel.suites))
      setValorMin(imovel.valor_min != null ? String(imovel.valor_min) : '')
      setValorMax(imovel.valor_max != null ? String(imovel.valor_max) : '')
      setDiferenciais(imovel.diferenciais ?? [])
      setDisponivel(imovel.disponivel)
    } else if (open && !imovel) {
      setNome('')
      setMetragem('')
      setQuartos('')
      setSuites('')
      setValorMin('')
      setValorMax('')
      setDiferenciais([])
      setDisponivel(true)
    }
    setNovoD('')
  }, [open, imovel])

  // ── Diferencial handlers ──
  const handleAddD = () => {
    const trimmed = novoD.trim()
    if (!trimmed || diferenciais.includes(trimmed)) return
    setDiferenciais((prev) => [...prev, trimmed])
    setNovoD('')
    novoDRef.current?.focus()
  }

  const handleRemoveD = (index: number) => {
    setDiferenciais((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddD()
    }
  }

  // ── Submit ──
  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('O nome do imóvel é obrigatório.')
      return
    }
    const metNum = parseFloat(metragem)
    const qtosNum = parseInt(quartos, 10)
    const suitesNum = parseInt(suites, 10)

    if (isNaN(metNum) || metNum <= 0) {
      toast.error('Informe uma metragem válida.')
      return
    }
    if (isNaN(qtosNum) || qtosNum < 0) {
      toast.error('Informe um número de quartos válido.')
      return
    }
    if (isNaN(suitesNum) || suitesNum < 0) {
      toast.error('Informe um número de suítes válido.')
      return
    }

    const payload = {
      nome: nome.trim(),
      metragem: metNum,
      quartos: qtosNum,
      suites: suitesNum,
      diferenciais,
      valor_min: valorMin !== '' ? parseFloat(valorMin) : null,
      valor_max: valorMax !== '' ? parseFloat(valorMax) : null,
      disponivel,
    }

    setSaving(true)
    try {
      const url = isEdit ? `/api/imoveis/${imovel.id}` : '/api/imoveis'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Erro desconhecido')
      }

      const json = await res.json() as { data: Imovel }
      toast.success(isEdit ? 'Imóvel atualizado com sucesso.' : 'Imóvel criado com sucesso.')
      onSaved(json.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar imóvel.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 480, maxWidth: 480 }}
        className="p-0 overflow-y-auto flex flex-col gap-0"
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 flex-shrink-0 flex items-center justify-between gap-3"
          style={{ backgroundColor: '#0A2EAD' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Building2 size={20} className="text-white/80 flex-shrink-0" />
            <h2 className="text-lg font-bold text-white leading-tight">
              {isEdit ? 'Editar Imóvel' : 'Novo Imóvel'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Fechar painel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Seção 1 — Identificação */}
          <div className="px-6 py-5 border-b border-gray-100">
            <SectionTitle>Identificação</SectionTitle>
            <div>
              <FieldLabel required>Nome</FieldLabel>
              <TextInput
                value={nome}
                onChange={setNome}
                placeholder="Ex: Apartamento 05, Cobertura 03"
              />
            </div>
          </div>

          {/* Seção 2 — Características */}
          <div className="px-6 py-5 border-b border-gray-100">
            <SectionTitle>Características</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <FieldLabel required>Metragem (m²)</FieldLabel>
                <TextInput
                  type="number"
                  value={metragem}
                  onChange={setMetragem}
                  placeholder="Ex: 120"
                />
              </div>
              <div>
                <FieldLabel required>Quartos</FieldLabel>
                <TextInput
                  type="number"
                  value={quartos}
                  onChange={setQuartos}
                  placeholder="Ex: 3"
                />
              </div>
              <div>
                <FieldLabel required>Suítes</FieldLabel>
                <TextInput
                  type="number"
                  value={suites}
                  onChange={setSuites}
                  placeholder="Ex: 2"
                />
              </div>
            </div>
          </div>

          {/* Seção 3 — Valores */}
          <div className="px-6 py-5 border-b border-gray-100">
            <SectionTitle>Valores</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Valor Mínimo (R$)</FieldLabel>
                <TextInput
                  type="number"
                  value={valorMin}
                  onChange={setValorMin}
                  placeholder="Ex: 1500000"
                />
              </div>
              <div>
                <FieldLabel>Valor Máximo (R$)</FieldLabel>
                <TextInput
                  type="number"
                  value={valorMax}
                  onChange={setValorMax}
                  placeholder="Ex: 2000000"
                />
              </div>
            </div>
          </div>

          {/* Seção 4 — Diferenciais */}
          <div className="px-6 py-5 border-b border-gray-100">
            <SectionTitle>Diferenciais</SectionTitle>
            <ul className="flex flex-col gap-2 mb-3">
              {diferenciais.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-gray-700 leading-snug">{d}</span>
                  <button
                    onClick={() => handleRemoveD(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 cursor-pointer focus-visible:outline-none"
                    aria-label={`Remover diferencial ${d}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                ref={novoDRef}
                value={novoD}
                onChange={(e) => setNovoD(e.target.value)}
                onKeyDown={handleDKeyDown}
                placeholder="Ex: Piscina privativa"
                className={cn(
                  'flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800',
                  'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue',
                  'transition-colors bg-white',
                )}
              />
              <button
                onClick={handleAddD}
                disabled={!novoD.trim()}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-alliance-blue/10 text-alliance-blue text-sm font-semibold rounded-xl hover:bg-alliance-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue"
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>
          </div>

          {/* Seção 5 — Disponibilidade */}
          <div className="px-6 py-5">
            <SectionTitle>Disponibilidade</SectionTitle>
            <button
              onClick={() => setDisponivel((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                disponivel
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 focus-visible:ring-emerald-400'
                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 focus-visible:ring-gray-400',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  disponivel ? 'bg-emerald-500' : 'bg-gray-400',
                )}
              />
              {disponivel ? 'Disponível' : 'Indisponível'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50/60">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isAdm}
            className="flex items-center gap-2 px-5 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Salvar Imóvel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
