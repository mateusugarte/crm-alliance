'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatPhone } from '@/lib/format-phone'
import {
  Activity, Bot, CalendarDays, CheckCircle2,
  ClipboardList, Clock3, Edit3, Home, Loader2, MapPin, MessageCircle,
  Pause, Phone, PhoneCall, Play, Send, Sparkles, Tags, Target, Thermometer,
  Trash2, X,
} from '@/lib/icons'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/supabase/types'
import type { Interaction, LeadFull } from './types'
import { LabelsSection } from './lead-labels-section'
import { LeadChatSection } from './lead-chat-section'
import { LeadCommentsSection } from '@/components/shared/lead-comments-section'

const STAGE_LABELS: Record<Lead['stage'], string> = {
  nao_respondeu: 'Não Respondeu',
  lead_frio: 'Lead Frio',
  lead_morno: 'Lead Morno',
  lead_quente: 'Lead Quente',
  follow_up: 'Follow Up',
  sem_interesse: 'Sem interesse',
  reuniao_agendada: 'Reunião Agendada',
  visita_confirmada: 'Venda Confirmada',
  cliente: 'Cliente',
}

const STAGE_OPTIONS = Object.entries(STAGE_LABELS) as [Lead['stage'], string][]

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onAssume?: () => void
  onTogglePause?: () => void
  onLeadUpdated?: (updatedLead: Lead) => void
  onLeadDeleted?: (leadId: string) => void
  currentUserId: string
}

function formatDate(value?: string | null, pattern = 'dd/MM/yyyy') {
  if (!value) return 'Não informado'
  return format(new Date(value), pattern, { locale: ptBR })
}

function distance(value?: string | null) {
  if (!value) return 'Sem registro'
  return formatDistanceToNow(new Date(value), { locale: ptBR, addSuffix: false })
}

function summaryWithoutStaleScore(summary?: string | null) {
  return summary?.replace(/, com score \d+(?:[.,]\d+)?\/10/i, '') ?? null
}

function getReasonTexts(input: unknown): string[] {
  if (!input) return []

  const pullText = (item: unknown): string | null => {
    if (!item) return null
    if (typeof item === 'string') return item
    if (typeof item !== 'object') return null

    const record = item as Record<string, unknown>
    const candidates = [record.label, record.reason, record.detail, record.text, record.message]
    const text = candidates.find(value => typeof value === 'string' && value.trim())
    return typeof text === 'string' ? text : null
  }

  if (Array.isArray(input)) return input.map(pullText).filter(Boolean).slice(0, 4) as string[]
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>
    if (Array.isArray(record.reasons)) return record.reasons.map(pullText).filter(Boolean).slice(0, 4) as string[]
    return Object.entries(record)
      .filter(([, value]) => value === true || typeof value === 'number' || typeof value === 'string')
      .map(([key]) => key.replaceAll('_', ' '))
      .slice(0, 4)
  }

  return []
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="min-w-0 border-r border-white/10 px-4 py-2.5 last:border-r-0">
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <p className="text-[11px] font-medium">{label}</p>
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <p className="truncate text-lg font-semibold text-white">{value}</p>
        {detail && <p className="truncate text-[10px] text-white/35">{detail}</p>}
      </div>
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-h-0 rounded-2xl border border-black/[0.06] bg-white/88 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-xl', className)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
          {icon}
        </div>
        <h3 className="text-xs font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-black/[0.05] py-2 last:border-b-0">
      <p className="text-[10px] font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-gray-800" title={value}>{value}</p>
    </div>
  )
}

export function LeadDetailModal({
  lead,
  open,
  onClose,
  onAssume,
  onTogglePause,
  onLeadUpdated,
  onLeadDeleted,
  currentUserId,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editStage, setEditStage] = useState<Lead['stage']>('lead_frio')
  const [editIntention, setEditIntention] = useState<Lead['intention']>(null)
  const [editImovel, setEditImovel] = useState('')
  const [editSummary, setEditSummary] = useState('')

  useEffect(() => {
    if (!open || !lead) return
    setFetchingFull(true)
    fetch(`/api/leads/${lead.id}`)
      .then(r => r.json() as Promise<{ data: LeadFull }>)
      .then(json => setFullLead(json.data))
      .catch(() => setFullLead(lead))
      .finally(() => setFetchingFull(false))
  }, [open, lead])

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
            const msg = payload.new as Interaction
            if (prev.some(m => m.wa_message_id && m.wa_message_id === msg.wa_message_id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [open, lead])

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

  useEffect(() => {
    if (!open) return
    const readSidebarState = () => {
      try {
        setSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
      } catch {
        setSidebarCollapsed(false)
      }
    }
    readSidebarState()
    window.addEventListener('storage', readSidebarState)
    return () => window.removeEventListener('storage', readSidebarState)
  }, [open])

  const displayLead = fullLead ?? lead

  const insight = useMemo(() => {
    if (!displayLead) return null

    const inbound = interactions.filter(msg => msg.direction === 'inbound' || msg.sender_type === 'lead')
    const outbound = interactions.filter(msg => msg.direction === 'outbound' && msg.sender_type !== 'lead')
    const lastInteraction = interactions.at(-1)
    const lastInbound = inbound.at(-1)
    const score = Math.max(0, Math.min(100, displayLead.lead_score ?? 0))
    const scoreLabel = (score / 10).toFixed(1).replace('.', ',')
    const reasons = getReasonTexts(displayLead.lead_score_reasons)
    const tags = [
      displayLead.aceitou_consultor ? 'quer consultor' : null,
      displayLead.automation_paused ? 'pausado' : null,
      displayLead.antes_ia ? 'antes da IA' : null,
      displayLead.via_disparo ? 'veio de disparo' : null,
      displayLead.pdf_enviado ? 'PDF enviado' : null,
    ].filter(Boolean) as string[]

    return {
      inbound,
      outbound,
      lastInteraction,
      lastInbound,
      score,
      scoreLabel,
      reasons,
      tags,
      age: distance(displayLead.created_at),
      stageTime: distance(displayLead.updated_at),
      lastInteractionText: lastInteraction ? distance(lastInteraction.created_at) : 'Sem conversa',
      lastInboundText: lastInbound ? distance(lastInbound.created_at) : 'Sem resposta',
    }
  }, [displayLead, interactions])

  if (!lead || !displayLead || !insight) return null

  const displayName = displayLead.name?.trim() || formatPhone(displayLead.phone) || 'Lead sem nome'
  const isMeetingLike = ['reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente'].includes(displayLead.stage)

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
      setFullLead({ ...json.data, labels: fullLead.labels })
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
      const res = await fetch(`/api/leads/${lead.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Pause a IA deste lead antes de enviar uma mensagem manual.')
        } else {
          const json = await res.json().catch(() => null) as { error?: string; detail?: string } | null
          toast.error(json?.error ?? 'Erro ao enviar mensagem no WhatsApp', {
            description: json?.detail,
          })
        }
        return
      }
      const json = await res.json() as { data: { wa_message_id?: string | null } }
      const optimistic: Interaction = {
        id: crypto.randomUUID(),
        direction: 'outbound',
        sender_type: 'corretor',
        sender_name: null,
        content: text,
        wa_message_id: json.data?.wa_message_id ?? null,
        created_at: new Date().toISOString(),
      }
      setInteractions(prev => [...prev, optimistic])
      setNewMessage('')
    } catch {
      toast.error('Erro ao enviar mensagem no WhatsApp')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleCallLead = async () => {
    if (assumeLoading) return
    if (onAssume) await handleAssume()
    const phone = displayLead.phone?.replace(/\D/g, '')
    if (phone) window.location.href = `tel:+${phone}`
  }

  return (
    <TooltipProvider delay={400}>
      {open && (
        <div
          className="fixed inset-y-0 right-0 z-50 flex bg-[#f5f5f7] shadow-[-18px_0_50px_rgba(15,23,42,0.12)]"
          style={{ left: sidebarCollapsed ? 64 : 220 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${displayName}`}
        >
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative border-b border-black/[0.06] bg-white/80 px-5 py-3 text-gray-950 backdrop-blur-2xl md:px-6">
              <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
                    >
                      <Thermometer size={11} />
                      {STAGE_LABELS[displayLead.stage]}
                    </span>
                    {insight.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h2 className="max-w-5xl truncate text-[26px] font-semibold leading-tight text-gray-950">
                    {displayName}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} />
                      {formatPhone(displayLead.phone)}
                    </span>
                    {displayLead.city && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} />
                        {displayLead.city}
                      </span>
                    )}
                    {displayLead.imovel_interesse && (
                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                        <Home size={12} />
                        {displayLead.imovel_interesse}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <div className="mr-1 text-right">
                    <p className="text-[10px] font-medium text-gray-400">Score comercial</p>
                    <p className="text-2xl font-semibold leading-none text-gray-950">{insight.scoreLabel}</p>
                  </div>
                  <button
                    onClick={handleCallLead}
                    disabled={assumeLoading || !displayLead.phone}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-40"
                  >
                    {assumeLoading ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
                    Ligar para o lead
                  </button>
                    {!editMode && (
                      <Tooltip>
                        <TooltipTrigger render={
                          <button
                            onClick={() => setEditMode(true)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                            aria-label="Editar lead"
                          >
                            <Edit3 size={15} />
                          </button>
                        } />
                        <TooltipContent side="bottom">Editar lead</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger render={
                          <button
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                            aria-label="Fechar painel"
                        >
                          <X size={18} />
                        </button>
                      } />
                      <TooltipContent side="left">Fechar</TooltipContent>
                    </Tooltip>
                </div>
              </div>
            </header>

            {fetchingFull ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-alliance-blue" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-3 xl:overflow-hidden">
                <div className="grid min-w-0 gap-3 xl:h-full xl:grid-cols-[minmax(300px,1.05fr)_minmax(330px,0.95fr)_minmax(260px,0.8fr)] xl:grid-rows-[auto_minmax(0,1fr)_auto]">
                  <main className="flex min-w-0 flex-col gap-3 xl:contents">
                    <div className="grid overflow-hidden rounded-2xl border border-black bg-gray-950 shadow-sm md:grid-cols-2 xl:col-span-3 xl:row-start-1 xl:grid-cols-4">
                      <MetricCard icon={<MessageCircle size={13} />} label="Interações" value={interactions.length || displayLead.interaction_count || 0} detail={`${insight.inbound.length} respostas`} />
                      <MetricCard icon={<Send size={13} />} label="Disparos" value={`${displayLead.reactivation_count ?? 0}x`} detail={displayLead.last_reactivated_at ? `último há ${distance(displayLead.last_reactivated_at)}` : 'nenhum'} />
                      <MetricCard icon={<Clock3 size={13} />} label="Tempo no estágio" value={insight.stageTime.replace('aproximadamente ', '')} detail={formatDate(displayLead.updated_at)} />
                      <MetricCard icon={<CalendarDays size={13} />} label={isMeetingLike ? 'Passou por reunião' : 'Lead criado'} value={insight.age.replace('aproximadamente ', '')} detail={formatDate(displayLead.created_at)} />
                    </div>

                    <SectionCard title="Resumo comercial" icon={<Sparkles size={13} />} className="flex min-h-0 flex-col overflow-hidden xl:col-start-1 xl:row-start-2">
                      {editMode ? (
                        <textarea
                          value={editSummary}
                          onChange={e => setEditSummary(e.target.value)}
                          rows={5}
                          placeholder="Resumo padronizado do lead..."
                          className="min-h-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-alliance-blue/20"
                        />
                      ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
                            {summaryWithoutStaleScore(displayLead.summary) || 'Nenhum resumo disponível ainda. Quando houver conversa suficiente, o ideal é registrar objetivo, produto de interesse, objeções e próximo passo.'}
                          </p>
                        </div>
                      )}

                      {insight.reasons.length > 0 && (
                        <div className="mt-3 grid gap-1.5 border-t border-black/[0.05] pt-3">
                          {insight.reasons.map(reason => (
                            <div key={reason} className="flex items-start gap-2 text-[11px] leading-snug text-gray-600">
                              <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Qualificação" icon={<Target size={13} />} className="xl:col-start-1 xl:row-start-3">
                      {editMode ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Nome</label>
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Telefone</label>
                            <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Cidade</label>
                            <input value={editCity} onChange={e => setEditCity(e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Estágio</label>
                            <select value={editStage} onChange={e => setEditStage(e.target.value as Lead['stage'])}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20">
                              {STAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Intenção</label>
                            <select value={editIntention ?? ''} onChange={e => setEditIntention((e.target.value || null) as Lead['intention'])}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20">
                              <option value="">Sem qualificação</option>
                              <option value="morar">Morar</option>
                              <option value="investir">Investir</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-gray-500">Imóvel de interesse</label>
                            <input value={editImovel} onChange={e => setEditImovel(e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-alliance-blue/20" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-4">
                          <InfoPill label="Telefone" value={formatPhone(displayLead.phone)} />
                          <InfoPill label="Cidade" value={displayLead.city || 'Não informado'} />
                          <InfoPill label="Intenção" value={displayLead.intention === 'morar' ? 'Morar' : displayLead.intention === 'investir' ? 'Investir' : 'Não informado'} />
                          <InfoPill label="Imóvel de interesse" value={displayLead.imovel_interesse || 'Não informado'} />
                          <InfoPill label="Última resposta" value={insight.lastInboundText} />
                          <InfoPill label="Última interação" value={insight.lastInteractionText} />
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Conversa no WhatsApp" icon={<MessageCircle size={13} />} className="flex min-h-[420px] min-w-0 flex-col overflow-hidden xl:col-start-2 xl:row-start-2 xl:row-span-2 xl:min-h-0">
                      <LeadChatSection
                        interactions={interactions}
                        fetchingInteractions={fetchingInteractions}
                        newMessage={newMessage}
                        sendingMessage={sendingMessage}
                        displayName={displayName}
                        onNewMessageChange={setNewMessage}
                        onSend={handleSendMessage}
                      />
                    </SectionCard>
                  </main>

                  <aside className="flex min-h-0 min-w-0 flex-col gap-2 xl:col-start-3 xl:row-start-2 xl:row-span-2">
                    <SectionCard title="Próximo passo" icon={<PhoneCall size={13} />} className="flex-shrink-0 bg-gray-950 p-3 text-white [&>div:first-child]:mb-2 [&>div>div]:bg-white/10 [&>div>div]:text-white/70 [&_h3]:text-white/65">
                      <p className="text-base font-semibold leading-tight text-white">
                        {displayLead.aceitou_consultor || displayLead.stage === 'lead_quente'
                          ? 'Ligar para o lead'
                          : insight.inbound.length === 0
                            ? 'Aguardar resposta'
                            : 'Avançar a conversa'}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
                        {displayLead.aceitou_consultor
                          ? 'O lead aceitou contato. Priorize uma ligação breve e objetiva.'
                          : insight.inbound.length === 0
                            ? 'Ainda não houve resposta do lead.'
                            : 'Use o contexto para definir o próximo compromisso.'}
                      </p>
                    </SectionCard>

                    <SectionCard title="Automação" icon={<Bot size={13} />} className="flex-shrink-0 p-3 [&>div:first-child]:mb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{displayLead.automation_paused ? 'Alice pausada' : 'Alice ativa'}</p>
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {displayLead.automation_paused ? 'Mensagens automáticas suspensas.' : 'Alice pode responder este lead.'}
                          </p>
                        </div>
                        <button
                          onClick={handleTogglePause}
                          disabled={pauseLoading}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition disabled:opacity-60',
                            displayLead.automation_paused
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-gray-900 text-white hover:bg-gray-800'
                          )}
                        >
                          {pauseLoading ? <Loader2 size={13} className="animate-spin" /> : displayLead.automation_paused ? <Play size={13} /> : <Pause size={13} />}
                          {displayLead.automation_paused ? 'Retomar' : 'Pausar'}
                        </button>
                      </div>
                    </SectionCard>

                    <SectionCard title="Etiquetas" icon={<Tags size={13} />} className="flex-shrink-0 p-3 [&>div:first-child]:mb-2">
                      <LabelsSection
                        labels={fullLead?.labels ?? []}
                        leadId={displayLead.id}
                        onLabelsChange={(updated) => {
                          if (fullLead) setFullLead({ ...fullLead, labels: updated })
                        }}
                      />
                    </SectionCard>

                    <SectionCard title="Comentários internos" icon={<ClipboardList size={13} />} className="min-h-[120px] flex-1 overflow-hidden p-3 [&>div:first-child]:mb-2">
                      <LeadCommentsSection leadId={displayLead.id} currentUserId={currentUserId} />
                    </SectionCard>

                    <SectionCard title="Linha do tempo" icon={<Activity size={13} />} className="hidden">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Lead criado', value: formatDate(displayLead.created_at, 'dd/MM/yyyy HH:mm'), active: true },
                          { label: 'Última mudança/atualização', value: formatDate(displayLead.updated_at, 'dd/MM/yyyy HH:mm'), active: true },
                          { label: 'Último disparo', value: displayLead.last_reactivated_at ? formatDate(displayLead.last_reactivated_at, 'dd/MM/yyyy HH:mm') : 'Sem disparo', active: !!displayLead.last_reactivated_at },
                          { label: 'Última resposta do lead', value: insight.lastInbound ? formatDate(insight.lastInbound.created_at, 'dd/MM/yyyy HH:mm') : 'Sem resposta', active: !!insight.lastInbound },
                        ].map(item => (
                          <div key={item.label} className="min-w-0 border-l border-black/[0.06] pl-2">
                            <div>
                              <p className="truncate text-[10px] font-medium text-gray-500">{item.label}</p>
                              <p className="truncate text-[10px] text-gray-400">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <div className="flex-shrink-0 rounded-2xl border border-black/[0.06] bg-white/88 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      {editMode ? (
                        <div className="flex gap-2">
                          <button onClick={handleSave} disabled={saveLoading}
                            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60">
                            {saveLoading && <Loader2 size={13} className="animate-spin" />}
                            {saveLoading ? 'Salvando...' : 'Salvar alterações'}
                          </button>
                          <button onClick={() => setEditMode(false)} disabled={saveLoading}
                            className="h-8 rounded-lg px-3 text-xs font-medium text-gray-500 transition hover:bg-gray-100 disabled:opacity-60">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={handleCallLead} disabled={assumeLoading || !displayLead.phone}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-950 px-3 text-[11px] font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60">
                            {assumeLoading ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
                            {assumeLoading ? 'Preparando...' : 'Ligar para o lead'}
                          </button>
                          <button onClick={() => setDeleteDialogOpen(true)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500" aria-label="Excluir lead">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <DialogFooter className="mt-2 flex-row justify-end gap-2 border-t-0 bg-transparent p-0">
            <button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleteLoading}
              className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50">
              {deleteLoading && <Loader2 size={13} className="animate-spin" />}
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
