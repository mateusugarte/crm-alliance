'use client'

import { useState } from 'react'
import { Loader2, X, UserPlus, Phone, MapPin, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { Lead } from '@/lib/supabase/types'

interface LeadCreateFormProps {
  open: boolean
  onClose: () => void
  onCreated: (lead: Lead) => void
}

const STAGES = [
  { value: 'lead_frio',          label: 'Lead Frio' },
  { value: 'lead_morno',         label: 'Lead Morno' },
  { value: 'lead_quente',        label: 'Lead Quente' },
  { value: 'follow_up',          label: 'Follow-up' },
  { value: 'reuniao_agendada',   label: 'Reunião Agendada' },
  { value: 'visita_confirmada',  label: 'Visita Confirmada' },
  { value: 'cliente',            label: 'Cliente' },
  { value: 'nao_respondeu',      label: 'Não Respondeu' },
]

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue bg-white placeholder:text-gray-300 transition-colors'
const selectCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue bg-white appearance-none transition-colors'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export function LeadCreateForm({ open, onClose, onCreated }: LeadCreateFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [stage, setStage] = useState('lead_frio')
  const [intention, setIntention] = useState<'' | 'morar' | 'investir'>('')
  const [imovelInteresse, setImovelInteresse] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName(''); setPhone(''); setCity(''); setStage('lead_frio')
    setIntention(''); setImovelInteresse('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!phone.trim()) { toast.error('Telefone é obrigatório'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim() || undefined,
          stage,
          intention: intention || undefined,
          imovel_interesse: imovelInteresse.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? 'Erro ao criar lead')
      }
      const j = await res.json() as { data: Lead }
      toast.success(`Lead "${j.data.name}" criado com sucesso!`)
      onCreated(j.data)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <SheetContent side="right" showCloseButton={false} style={{ width: 440, maxWidth: 440 }} className="p-0 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0 bg-alliance-dark">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <UserPlus size={15} className="text-white/60" />
                <span className="text-white/60 text-xs font-medium">Novo Lead Manual</span>
              </div>
              <h2 className="text-xl font-bold text-white">Cadastrar Lead</h2>
              <p className="text-white/50 text-xs mt-0.5">IA pausada automaticamente</p>
            </div>
            <button onClick={handleClose} className="text-white/50 hover:text-white p-1 rounded-lg cursor-pointer focus-visible:outline-none">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5 flex-1">
          {/* Identificação */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Identificação</p>
            <div className="flex flex-col gap-3">
              <Field label="Nome completo" required>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" className={inputCls} />
              </Field>
              <Field label="Telefone" required>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(27) 99999-9999" className={inputCls + ' pl-9'} />
                </div>
              </Field>
              <Field label="Cidade">
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Castelo" className={inputCls + ' pl-9'} />
                </div>
              </Field>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Qualificação */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Qualificação</p>
            <div className="flex flex-col gap-3">
              <Field label="Estágio no funil">
                <div className="relative">
                  <select value={stage} onChange={e => setStage(e.target.value)} className={selectCls}>
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="Intenção de compra">
                <div className="relative">
                  <select value={intention} onChange={e => setIntention(e.target.value as '' | 'morar' | 'investir')} className={selectCls}>
                    <option value="">Não informado</option>
                    <option value="morar">Morar</option>
                    <option value="investir">Investir</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="Imóvel de interesse">
                <input value={imovelInteresse} onChange={e => setImovelInteresse(e.target.value)} placeholder="Ex: Apto 301 — Bloco 2" className={inputCls} />
              </Field>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={handleClose} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !phone.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-alliance-dark rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Criar Lead'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
