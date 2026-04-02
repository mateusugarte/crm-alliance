'use client'

import { useEffect, useState, useRef } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatPhone } from '@/lib/format-phone'
import {
  Phone, MapPin, Home, Target, MessageSquare, Bot, UserCheck,
  Pause, Play, Loader2, X, Pencil, Trash2, Plus, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Label {
  id: string
  name: string
  color: string
}

interface Interaction {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'lead' | 'bot' | 'corretor'
  sender_name: string | null
  content: string
  wa_message_id: string | null
  created_at: string
}

interface LeadFull extends Lead {
  labels?: Label[]
}

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onAssume?: () => void
  onTogglePause?: () => void
  onLeadUpdated?: (updatedLead: Lead) => void
  onLeadDeleted?: (leadId: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<Lead['stage'], string> = {
  lead_frio: 'Lead Frio',
  lead_morno: 'Lead Morno',
  lead_quente: 'Lead Quente',
  follow_up: 'Follow Up',
  reuniao_agendada: 'Reunião Agendada',
  visita_confirmada: 'Visita Confirmada',
  cliente: 'Cliente',
}

const STAGE_COLORS: Record<Lead['stage'], string> = {
  lead_frio: 'var(--color-stage-frio)',
  lead_morno: 'var(--color-stage-morno)',
  lead_quente: 'var(--color-stage-quente)',
  follow_up: 'var(--color-stage-follow-up)',
  reuniao_agendada: 'var(--color-stage-reuniao)',
  visita_confirmada: 'var(--color-stage-visita)',
  cliente: 'var(--color-stage-cliente)',
}

const STAGE_OPTIONS = Object.entries(STAGE_LABELS) as [Lead['stage'], string][]

const LABEL_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function InfoChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
      {icon}
      <span className="truncate text-xs text-gray-700">{text}</span>
    </div>
  )
}

// ─── Labels section ───────────────────────────────────────────────────────────

interface LabelsSectionProps {
  labels: Label[]
  leadId: string
  onLabelsChange: (labels: Label[]) => void
}

function LabelsSection({ labels, leadId, onLabelsChange }: LabelsSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<Label[]>([])
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0])
  const [creatingNew, setCreatingNew] = useState(false)
  const [loadingLabels, setLoadingLabels] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    setLoadingLabels(true)
    fetch('/api/labels')
      .then(r => r.json() as Promise<{ data: Label[] }>)
      .then(json => setAvailableLabels(json.data ?? []))
      .catch(() => toast.error('Erro ao carregar etiquetas'))
      .finally(() => setLoadingLabels(false))
  }, [popoverOpen])

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
        setCreatingNew(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

  const handleAddLabel = async (label: Label) => {
    if (labels.some(l => l.id === label.id)) return
    setActionLoading(label.id)
    try {
      const res = await fetch(`/api/leads/${leadId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: label.id }),
      })
      if (!res.ok) throw new Error()
      onLabelsChange([...labels, label])
      toast.success(`Etiqueta "${label.name}" adicionada`)
    } catch {
      toast.error('Erro ao adicionar etiqueta')
    } finally {
      setActionLoading(null)
      setPopoverOpen(false)
    }
  }

  const handleRemoveLabel = async (labelId: string) => {
    setActionLoading(labelId)
    try {
      const res = await fetch(`/api/leads/${leadId}/labels?label_id=${labelId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      onLabelsChange(labels.filter(l => l.id !== labelId))
      toast.success('Etiqueta removida')
    } catch {
      toast.error('Erro ao remover etiqueta')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    setActionLoading('new')
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Label }
      const created = json.data
      await handleAddLabel(created)
      setNewLabelName('')
      setCreatingNew(false)
    } catch {
      toast.error('Erro ao criar etiqueta')
    } finally {
      setActionLoading(null)
    }
  }

  const unattachedLabels = availableLabels.filter(al => !labels.some(l => l.id === al.id))

  return (
    <section>
      <SectionTitle>Etiquetas</SectionTitle>
      <div className="flex flex-wrap gap-1.5 items-center">
        {labels.map(label => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <button
              onClick={() => handleRemoveLabel(label.id)}
              disabled={actionLoading === label.id}
              className="hover:opacity-70 transition-opacity focus-visible:outline-none cursor-pointer"
              aria-label={`Remover etiqueta ${label.name}`}
            >
              {actionLoading === label.id
                ? <Loader2 size={10} className="animate-spin" />
                : <X size={10} />
              }
            </button>
          </span>
        ))}

        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen(v => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-alliance-blue border border-alliance-blue/30 bg-alliance-blue/5 hover:bg-alliance-blue/10 px-2.5 py-1 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue"
          >
            <Plus size={11} />
            Adicionar
          </button>

          {popoverOpen && (
            <div className="absolute left-0 top-8 z-50 w-56 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
              {loadingLabels ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-alliance-blue" />
                </div>
              ) : (
                <>
                  {unattachedLabels.length > 0 && (
                    <div className="py-1.5 max-h-48 overflow-y-auto">
                      {unattachedLabels.map(label => (
                        <button
                          key={label.id}
                          onClick={() => handleAddLabel(label)}
                          disabled={actionLoading === label.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className="text-xs text-gray-700">{label.name}</span>
                          {actionLoading === label.id && (
                            <Loader2 size={11} className="animate-spin ml-auto text-alliance-blue" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {unattachedLabels.length > 0 && (
                    <div className="border-t border-gray-100" />
                  )}

                  {!creatingNew ? (
                    <button
                      onClick={() => setCreatingNew(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-alliance-blue hover:bg-alliance-blue/5 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      Nova etiqueta
                    </button>
                  ) : (
                    <div className="p-3 flex flex-col gap-2">
                      <input
                        autoFocus
                        value={newLabelName}
                        onChange={e => setNewLabelName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateLabel() }}
                        placeholder="Nome da etiqueta"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {LABEL_PALETTE.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewLabelColor(color)}
                            className={cn(
                              'w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110',
                              newLabelColor === color && 'ring-2 ring-offset-1 ring-gray-400'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleCreateLabel}
                          disabled={actionLoading === 'new' || !newLabelName.trim()}
                          className="flex-1 text-xs bg-alliance-dark text-white py-1.5 rounded-lg hover:bg-alliance-dark/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === 'new' ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Criar'}
                        </button>
                        <button
                          onClick={() => { setCreatingNew(false); setNewLabelName('') }}
                          className="flex-1 text-xs bg-gray-100 text-gray-600 py-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeadDetailModal({
  lead,
  open,
  onClose,
  onAssume,
  onTogglePause,
  onLeadUpdated,
  onLeadDeleted,
}: LeadDetailModalProps) {
  const [assumeLoading, setAssumeLoading] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [fullLead, setFullLead] = useState<LeadFull | null>(null)
  const [fetchingFull, setFetchingFull] = useState(false)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [fetchingInteractions, setFetchingInteractions] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editStage, setEditStage] = useState<Lead['stage']>('lead_frio')
  const [editIntention, setEditIntention] = useState<Lead['intention']>(null)
  const [editImovel, setEditImovel] = useState('')
  const [editSummary, setEditSummary] = useState('')

  // Fetch full lead (with labels) when modal opens
  useEffect(() => {
    if (!open || !lead) return
    setFetchingFull(true)
    fetch(`/api/leads/${lead.id}`)
      .then(r => r.json() as Promise<{ data: LeadFull }>)
      .then(json => setFullLead(json.data))
      .catch(() => setFullLead(lead))
      .finally(() => setFetchingFull(false))
  }, [open, lead])

  // Fetch interactions + subscribe Realtime when modal opens
  useEffect(() => {
    if (!open || !lead) return

    setFetchingInteractions(true)
    fetch(`/api/leads/${lead.id}/interactions`)
      .then(r => r.json() as Promise<{ data: Interaction[] }>)
      .then(json => setInteractions(json.data ?? []))
      .catch(() => setInteractions([]))
      .finally(() => setFetchingInteractions(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`modal-interactions-${lead.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interactions', filter: `lead_id=eq.${lead.id}` },
        (payload) => {
          setInteractions(prev => {
            // evita duplicar caso o optimistic update já exista
            const msg = payload.new as Interaction
            if (prev.some(m => m.wa_message_id && m.wa_message_id === msg.wa_message_id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [open, lead])

  // Auto-scroll chat to bottom when interactions load or a new one arrives
  useEffect(() => {
    if (interactions.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [interactions])

  // Reset all state when modal closes or lead changes
  useEffect(() => {
    if (!open) {
      setAssumeLoading(false)
      setPauseLoading(false)
      setEditMode(false)
      setSaveLoading(false)
      setFullLead(null)
      setInteractions([])
      setNewMessage('')
    }
  }, [open])

  // Populate edit fields when entering edit mode
  useEffect(() => {
    if (!editMode || !fullLead) return
    setEditName(fullLead.name ?? '')
    setEditPhone(fullLead.phone ?? '')
    setEditCity(fullLead.city ?? '')
    setEditStage(fullLead.stage)
    setEditIntention(fullLead.intention)
    setEditImovel(fullLead.imovel_interesse ?? '')
    setEditSummary(fullLead.summary ?? '')
  }, [editMode, fullLead])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editMode) setEditMode(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, editMode])

  if (!lead) return null

  const displayLead = fullLead ?? lead
  const tempoNoStage = formatDistanceToNow(new Date(displayLead.updated_at), {
    locale: ptBR,
    addSuffix: false,
  })
  const stageColor = STAGE_COLORS[displayLead.stage]
  const displayName = displayLead.name?.trim() || displayLead.phone || 'Lead sem nome'

  const handleAssume = async () => {
    if (!onAssume || assumeLoading) return
    setAssumeLoading(true)
    try { await onAssume() } finally { setAssumeLoading(false) }
  }

  const handleTogglePause = async () => {
    if (!onTogglePause || pauseLoading) return
    setPauseLoading(true)
    try { await onTogglePause() } finally { setPauseLoading(false) }
  }

  const handleSave = async () => {
    if (!fullLead) return
    setSaveLoading(true)
    try {
      const res = await fetch(`/api/leads/${fullLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          city: editCity || null,
          stage: editStage,
          intention: editIntention,
          imovel_interesse: editImovel || null,
          summary: editSummary || null,
        }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Lead }
      const updated: LeadFull = { ...json.data, labels: fullLead.labels }
      setFullLead(updated)
      onLeadUpdated?.(json.data)
      setEditMode(false)
      toast.success('Lead atualizado')
    } catch {
      toast.error('Erro ao salvar lead')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!fullLead) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/leads/${fullLead.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Lead excluído')
      setDeleteDialogOpen(false)
      onLeadDeleted?.(fullLead.id)
      onClose()
    } catch {
      toast.error('Erro ao excluir lead')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSendMessage = async () => {
    const text = newMessage.trim()
    if (!text || sendingMessage || !lead) return
    setSendingMessage(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Interaction }
      setInteractions(prev => [...prev, json.data])
      setNewMessage('')
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSendingMessage(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delay={400}>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          style={{ width: 480, maxWidth: 480 }}
          className="p-0 overflow-y-auto flex flex-col gap-0"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ backgroundColor: '#0A2EAD' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white leading-tight truncate">{displayName}</h2>
                <p className="text-white/60 text-xs mt-0.5">{formatPhone(displayLead.phone)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white transition-colors duration-300"
                  style={{ backgroundColor: stageColor }}
                >
                  {STAGE_LABELS[displayLead.stage]}
                </span>
                {!editMode && (
                  <Tooltip>
                    <TooltipTrigger render={
                      <button
                        onClick={() => setEditMode(true)}
                        className="text-white/60 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                        aria-label="Editar lead"
                      >
                        <Pencil size={15} />
                      </button>
                    } />
                    <TooltipContent side="bottom">Editar lead</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger render={
                    <button
                      onClick={onClose}
                      className="text-white/60 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                      aria-label="Fechar painel"
                    >
                      <X size={16} />
                    </button>
                  } />
                  <TooltipContent side="left">Fechar (Esc)</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Loading overlay while fetching full data */}
          {fetchingFull && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-alliance-blue" />
            </div>
          )}

          {/* Body */}
          {!fetchingFull && (
            <div className="flex flex-col gap-5 px-6 py-5 flex-1">

              {/* Seção 1: Informações */}
              <section>
                <SectionTitle>Informações</SectionTitle>
                {editMode ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 font-medium">Nome</label>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 font-medium">Telefone</label>
                        <input
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 font-medium">Cidade</label>
                      <input
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        placeholder="Ex: Castelo, ES"
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <InfoChip icon={<Phone size={13} className="text-alliance-blue flex-shrink-0" />} text={formatPhone(displayLead.phone)} />
                    {displayLead.city && (
                      <InfoChip icon={<MapPin size={13} className="text-alliance-blue flex-shrink-0" />} text={displayLead.city} />
                    )}
                  </div>
                )}
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 2: Qualificação */}
              <section>
                <SectionTitle>Qualificação</SectionTitle>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 font-medium">Stage</label>
                      <select
                        value={editStage}
                        onChange={e => setEditStage(e.target.value as Lead['stage'])}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue bg-white"
                      >
                        {STAGE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 font-medium">Intenção</label>
                      <select
                        value={editIntention ?? ''}
                        onChange={e => setEditIntention((e.target.value || null) as Lead['intention'])}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue bg-white"
                      >
                        <option value="">Sem qualificação</option>
                        <option value="morar">Morar</option>
                        <option value="investir">Investir</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-xs text-gray-500 font-medium">Imóvel interesse</label>
                      <input
                        value={editImovel}
                        onChange={e => setEditImovel(e.target.value)}
                        placeholder="Ex: Apartamento 01"
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {displayLead.intention && (
                      <InfoChip
                        icon={<Target size={13} className="text-alliance-blue flex-shrink-0" />}
                        text={displayLead.intention === 'morar' ? 'Morar' : 'Investir'}
                      />
                    )}
                    {displayLead.imovel_interesse && (
                      <InfoChip
                        icon={<Home size={13} className="text-alliance-blue flex-shrink-0" />}
                        text={displayLead.imovel_interesse}
                      />
                    )}
                    {!displayLead.intention && !displayLead.imovel_interesse && (
                      <p className="text-xs text-gray-400 col-span-2">Nenhuma qualificação registrada.</p>
                    )}
                  </div>
                )}
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 3: Automação */}
              <section>
                <SectionTitle>Automação</SectionTitle>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {displayLead.automation_paused ? 'IA pausada' : 'IA ativa'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {displayLead.automation_paused
                        ? 'Respostas automáticas suspensas'
                        : 'Respondendo automaticamente'}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger render={
                      <button
                        onClick={handleTogglePause}
                        disabled={pauseLoading}
                        aria-label={displayLead.automation_paused ? 'Retomar IA' : 'Pausar IA'}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-alliance-blue disabled:opacity-60 disabled:cursor-not-allowed',
                          displayLead.automation_paused
                            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 focus-visible:ring-orange-400'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        )}
                      >
                        {pauseLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : displayLead.automation_paused ? (
                          <Play size={12} />
                        ) : (
                          <Pause size={12} />
                        )}
                        {displayLead.automation_paused ? 'Retomar' : 'Pausar'}
                      </button>
                    } />
                    <TooltipContent side="top">
                      {displayLead.automation_paused ? 'Retomar respostas automáticas da IA' : 'Pausar respostas automáticas da IA'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 4: Etiquetas */}
              <LabelsSection
                labels={fullLead?.labels ?? []}
                leadId={displayLead.id}
                onLabelsChange={(updated) => {
                  if (fullLead) setFullLead({ ...fullLead, labels: updated })
                }}
              />

              <div className="border-t border-gray-100" />

              {/* Seção 5: Resumo IA */}
              <section>
                <SectionTitle>Resumo da IA</SectionTitle>
                {editMode ? (
                  <textarea
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    rows={4}
                    placeholder="Resumo gerado pela IA..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue resize-none"
                  />
                ) : (
                  <div className="bg-alliance-dark/5 border border-alliance-dark/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot size={13} className="text-alliance-dark" />
                      <span className="text-xs font-bold text-alliance-dark uppercase tracking-wider">Análise</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {displayLead.summary ?? 'Nenhum resumo disponível ainda.'}
                    </p>
                  </div>
                )}
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 6: Métricas */}
              <section>
                <SectionTitle>Métricas</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-alliance-dark">{displayLead.interaction_count}</p>
                    <p className="text-xs text-gray-400 mt-0.5">interações</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs font-bold text-alliance-dark">
                      {new Date(displayLead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">cadastro</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-2.5 mt-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">há {tempoNoStage} neste estágio</span>
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 7: Conversas WhatsApp */}
              <section>
                <SectionTitle>Conversas</SectionTitle>

                {/* Área de mensagens */}
                <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-100" style={{ backgroundColor: '#ECE5DD' }}>
                  {/* Chat body */}
                  <div className="flex flex-col gap-1.5 p-3 max-h-72 overflow-y-auto">
                    {fetchingInteractions ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    ) : interactions.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-xs text-gray-400">Nenhuma conversa registrada ainda.</p>
                      </div>
                    ) : (
                      interactions.map((msg) => {
                        const isLeft = msg.sender_type === 'lead'
                        const time = format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })

                        // Estilos por remetente
                        const bubbleStyle = {
                          lead:     'bg-white rounded-bl-sm',
                          bot:      'bg-[#DCF8C6] rounded-br-sm',
                          corretor: 'bg-[#D0E8FF] rounded-br-sm',
                        }[msg.sender_type]

                        const labelStyle = {
                          lead:     'text-gray-500',
                          bot:      'text-emerald-700',
                          corretor: 'text-alliance-blue',
                        }[msg.sender_type]

                        const senderLabel = {
                          lead:     displayName,
                          bot:      msg.sender_name ?? 'IA Alliance',
                          corretor: msg.sender_name ?? 'Corretor',
                        }[msg.sender_type]

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${bubbleStyle}`}>
                              {/* Remetente */}
                              <div className={`flex items-center gap-1 mb-0.5 ${labelStyle}`}>
                                {msg.sender_type === 'bot' && (
                                  <Bot size={10} className="flex-shrink-0" />
                                )}
                                <p className="text-[10px] font-bold leading-none">{senderLabel}</p>
                              </div>
                              {/* Conteúdo */}
                              <p className="text-sm text-gray-800 leading-snug whitespace-pre-wrap break-words pr-8">
                                {msg.content}
                              </p>
                              {/* Hora */}
                              <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-400 leading-none">
                                {time}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input de nova mensagem */}
                  <div className="flex items-end gap-2 px-3 py-2.5 bg-[#F0F0F0] border-t border-gray-200">
                    <textarea
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder="Digite uma mensagem..."
                      rows={1}
                      className="flex-1 text-sm bg-white rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 border border-gray-200 leading-snug max-h-24 overflow-y-auto"
                      style={{ lineHeight: '1.4' }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-alliance-dark text-white rounded-full hover:bg-alliance-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
                      aria-label="Enviar mensagem"
                    >
                      {sendingMessage
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Send size={15} />
                      }
                    </button>
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* Seção 8: Ações */}
              <section className="pb-2">
                <SectionTitle>Ações</SectionTitle>

                {editMode ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-alliance-dark text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveLoading && <Loader2 size={15} className="animate-spin" />}
                      {saveLoading ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      disabled={saveLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger render={
                          <button
                            onClick={handleAssume}
                            disabled={assumeLoading}
                            aria-label="Assumir esta conversa"
                            className="flex-1 flex items-center justify-center gap-2 bg-alliance-dark text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {assumeLoading ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <UserCheck size={15} />
                            )}
                            {assumeLoading ? 'Assumindo...' : 'Assumir conversa'}
                          </button>
                        } />
                        <TooltipContent side="top">Atribuir este lead ao seu perfil</TooltipContent>
                      </Tooltip>
                    </div>

                    <button
                      onClick={() => setDeleteDialogOpen(true)}
                      className="flex items-center justify-center gap-1.5 text-red-500 text-xs font-medium py-1.5 rounded-xl hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
                    >
                      <Trash2 size={13} />
                      Excluir lead
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={18} />
              Excluir lead
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir{' '}
            <span className="font-semibold text-gray-800">{displayName}</span>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex-row justify-end gap-2 border-t-0 bg-transparent p-0 mt-2">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {deleteLoading && <Loader2 size={13} className="animate-spin" />}
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  )
}
