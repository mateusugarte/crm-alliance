'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Tag, X, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Label {
  id: string
  name: string
  color: string
}

const STAGE_OPTIONS: { value: Lead['stage']; label: string }[] = [
  { value: 'lead_frio', label: 'Lead Frio' },
  { value: 'lead_morno', label: 'Lead Morno' },
  { value: 'lead_quente', label: 'Lead Quente' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'reuniao_agendada', label: 'Reunião Agendada' },
  { value: 'visita_confirmada', label: 'Visita Confirmada' },
  { value: 'cliente', label: 'Cliente' },
]

const LABEL_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6',
  '#0A2EAD', '#1E90FF',
]

// ─── Lead form ────────────────────────────────────────────────────────────────

function NewLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [stage, setStage] = useState<Lead['stage']>('lead_frio')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setName('')
    setPhone('')
    setCity('')
    setStage('lead_frio')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!phone.trim()) { toast.error('Telefone é obrigatório'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), city: city.trim() || undefined, stage }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Erro ao criar lead')
      }
      toast.success(`Lead "${name.trim()}" criado com sucesso`)
      handleClose()
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-alliance-dark">Novo Lead</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Nome <span className="text-red-400">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome completo"
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Telefone <span className="text-red-400">*</span></label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="5511999990000"
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue"
            />
            <p className="text-[11px] text-gray-400">Com código do país: 55 + DDD + número</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Cidade</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ex: Castelo, ES"
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Stage inicial</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as Lead['stage'])}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue bg-white"
            >
              {STAGE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Criar Lead
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Labels manager ───────────────────────────────────────────────────────────

function LabelsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(LABEL_PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/labels')
      .then(r => r.json() as Promise<{ data: Label[] }>)
      .then(json => setLabels(json.data ?? []))
      .catch(() => toast.error('Erro ao carregar etiquetas'))
      .finally(() => setLoading(false))
  }, [open])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Label }
      setLabels(prev => [...prev, json.data])
      setNewName('')
      toast.success(`Etiqueta "${json.data.name}" criada`)
    } catch {
      toast.error('Erro ao criar etiqueta')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (label: Label) => {
    setDeletingId(label.id)
    try {
      const res = await fetch(`/api/labels/${label.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLabels(prev => prev.filter(l => l.id !== label.id))
      toast.success(`Etiqueta "${label.name}" removida`)
    } catch {
      toast.error('Erro ao remover etiqueta')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 380, maxWidth: 380 }}
        className="p-0 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-alliance-dark text-base">Etiquetas</h2>
            <p className="text-xs text-gray-400 mt-0.5">Gerencie as etiquetas dos leads</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nova etiqueta */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Nova etiqueta</p>
          <div className="flex gap-2 mb-2">
            {LABEL_PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  'w-5 h-5 rounded-full flex-shrink-0 transition-transform cursor-pointer',
                  newColor === c && 'ring-2 ring-offset-1 ring-gray-400 scale-110'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Nome da etiqueta..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 focus:border-alliance-blue"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-alliance-blue" />
            </div>
          ) : labels.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma etiqueta criada ainda</p>
          ) : (
            <div className="flex flex-col gap-2">
              {labels.map(label => (
                <div
                  key={label.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-gray-700 font-medium truncate">{label.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(label)}
                    disabled={deletingId === label.id}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === label.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function KanbanPageHeader() {
  const router = useRouter()
  const [leadModalOpen, setLeadModalOpen] = useState(false)
  const [labelsSheetOpen, setLabelsSheetOpen] = useState(false)

  const handleLeadCreated = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setLabelsSheetOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:border-alliance-dark hover:text-alliance-dark transition-colors bg-white cursor-pointer"
        >
          <Tag size={14} />
          Etiquetas
        </button>
        <button
          onClick={() => setLeadModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-alliance-dark text-white rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer"
        >
          <Plus size={14} />
          Novo Lead
        </button>
      </div>

      <NewLeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onCreated={handleLeadCreated}
      />

      <LabelsSheet
        open={labelsSheetOpen}
        onClose={() => setLabelsSheetOpen(false)}
      />
    </>
  )
}
