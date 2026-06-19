'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, RefreshCw, Play, Pause, Square,
  Pencil, Check, X, MessageSquare, Timer,
  Trash2, UserPlus, Clock, Settings, AlertTriangle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Campaign, Dispatch } from '@/lib/supabase/types'

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  running:   'bg-blue-500/15 text-blue-500',
  paused:    'bg-amber-500/15 text-amber-500',
  completed: 'bg-green-500/15 text-green-600',
  cancelled: 'bg-red-500/15 text-red-500',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', running: 'Executando', paused: 'Pausado',
  completed: 'Concluído', cancelled: 'Cancelado',
}
const DISPATCH_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-muted text-muted-foreground',
  sent:      'bg-green-500/15 text-green-600',
  failed:    'bg-red-500/15 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
}
const DISPATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', sent: 'Enviado', failed: 'Falhou', cancelled: 'Cancelado',
}
const INTERVAL_OPTIONS = [
  { label: '1–2 min', min: 1, max: 2 },
  { label: '2–5 min', min: 2, max: 5 },
  { label: '5–10 min', min: 5, max: 10 },
  { label: '10–20 min', min: 10, max: 20 },
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface CampaignDetail extends Campaign { dispatches?: Dispatch[] }
interface CountdownState { remaining: number; total: number }

function StatusBadge({ status, running }: { status: string; running?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.draft)}>
      {running && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function DisparoDetailPage() {
  const router  = useRouter()
  const params  = useParams()
  const id      = params.id as string

  const [campaign, setCampaign]       = useState<CampaignDetail | null>(null)
  const [dispatches, setDispatches]   = useState<Dispatch[]>([])
  const [loading, setLoading]         = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Socket countdown
  const [countdown, setCountdown]     = useState<CountdownState | null>(null)

  // Local countdown fallback
  const [localSec, setLocalSec]       = useState<number | null>(null)
  const [localTotal, setLocalTotal]   = useState<number>(60)
  const localTimerRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  // Inline message edit
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editValue, setEditValue]     = useState('')
  const [saving, setSaving]           = useState(false)

  // Expanded message rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Delete dispatch
  const [deletingDispatchId, setDeletingDispatchId] = useState<string | null>(null)

  // Add contacts panel
  const [showAddContacts, setShowAddContacts] = useState(false)
  const [phonesInput, setPhonesInput]   = useState('')
  const [addingContacts, setAddingContacts] = useState(false)
  const [addContactsError, setAddContactsError] = useState<string | null>(null)
  const [quickSelectLoading, setQuickSelectLoading] = useState<number | null>(null)
  const [quickSelectInfo, setQuickSelectInfo] = useState<string | null>(null)

  // Edit campaign panel
  const [showEdit, setShowEdit]         = useState(false)
  const [editName, setEditName]         = useState('')
  const [editIntervalIdx, setEditIntervalIdx] = useState(1)
  const [editHoursStart, setEditHoursStart]   = useState(0)
  const [editHoursEnd, setEditHoursEnd]       = useState(23)
  const [savingEdit, setSavingEdit]     = useState(false)

  // Delete campaign confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      if (res.ok) {
        const data = await res.json() as CampaignDetail
        setCampaign(data)
        setDispatches(data.dispatches ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // Sync edit state when campaign loads
  useEffect(() => {
    if (!campaign) return
    setEditName(campaign.name)
    const idx = INTERVAL_OPTIONS.findIndex(o => o.min === campaign.interval_min && o.max === campaign.interval_max)
    setEditIntervalIdx(idx >= 0 ? idx : 1)
    setEditHoursStart(campaign.allowed_hours_start ?? 0)
    setEditHoursEnd(campaign.allowed_hours_end ?? 23)
  }, [campaign])

  // ── Local countdown timer ─────────────────────────────────────────────────
  const startLocalTimer = useCallback((minMin: number, minMax: number) => {
    if (localTimerRef.current) clearInterval(localTimerRef.current)
    const totalSec = Math.round((minMin + Math.random() * (minMax - minMin)) * 60)
    setLocalTotal(totalSec)
    setLocalSec(totalSec)
    localTimerRef.current = setInterval(() => {
      setLocalSec(prev => {
        if (prev === null || prev <= 1) {
          const next = Math.round((minMin + Math.random() * (minMax - minMin)) * 60)
          setLocalTotal(next)
          return next
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopLocalTimer = useCallback(() => {
    if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null }
    setLocalSec(null)
  }, [])

  useEffect(() => {
    if (campaign?.status === 'running') {
      if (!countdown) startLocalTimer(campaign.interval_min ?? 2, campaign.interval_max ?? 5)
    } else {
      stopLocalTimer()
      setCountdown(null)
    }
    return () => { stopLocalTimer() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.status])

  useEffect(() => {
    if (countdown) { stopLocalTimer(); setLocalSec(null) }
  }, [countdown, stopLocalTimer])

  // ── Socket.io ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
      return
    }
    const apiUrl = process.env.NEXT_PUBLIC_DISPARO_API_URL || 'http://localhost:3001'
    import('socket.io-client').then(({ io }) => {
      const socket = io(apiUrl, { transports: ['websocket'] })
      socketRef.current = socket
      socket.on('campaign:dispatch:sent', (payload: { dispatch_id: string }) => {
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatch_id ? { ...d, status: 'sent', sent_at: new Date().toISOString() } : d
        ))
        setCampaign(prev => prev ? { ...prev, sent_count: prev.sent_count + 1 } : prev)
        if (campaign) startLocalTimer(campaign.interval_min ?? 2, campaign.interval_max ?? 5)
      })
      socket.on('campaign:dispatch:failed', (payload: { dispatch_id: string; error?: string }) => {
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatch_id ? { ...d, status: 'failed', error: payload.error ?? null } : d
        ))
        setCampaign(prev => prev ? { ...prev, failed_count: prev.failed_count + 1 } : prev)
      })
      socket.on('campaign:countdown', (payload: { remaining: number; total: number }) => {
        setCountdown({ remaining: payload.remaining, total: payload.total })
      })
      socket.on('campaign:completed', () => { setCountdown(null); stopLocalTimer(); loadData() })
      socket.on('campaign:paused',    () => { setCountdown(null); stopLocalTimer(); loadData() })
      socket.on('campaign:stopped',   () => { setCountdown(null); stopLocalTimer(); loadData() })
    })
    return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.status, id])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    if (!campaign) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await disparoFetch(`/api/campaigns/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setActionError(err.error ?? 'Erro ao executar ação')
        setActionLoading(false)
        return
      }
      await loadData()
      if (action === 'start' && campaign) {
        startLocalTimer(campaign.interval_min ?? 2, campaign.interval_max ?? 5)
      } else {
        stopLocalTimer()
      }
    } catch { setActionError('Erro de conexão') }
    setActionLoading(false)
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  const startEdit = (d: Dispatch) => { setEditingId(d.id); setEditValue(d.message_sent ?? '') }
  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const saveEdit = async (dispatchId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/dispatches/${dispatchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editValue }),
      })
      if (res.ok) {
        setDispatches(prev => prev.map(d =>
          d.id === dispatchId ? { ...d, message_sent: editValue.trim() } : d
        ))
        setEditingId(null)
        setEditValue('')
      }
    } catch { /* silent */ }
    setSaving(false)
  }

  const toggleExpand = (rowId: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(rowId) ? n.delete(rowId) : n.add(rowId); return n })
  }

  // ── Delete dispatch ───────────────────────────────────────────────────────
  const deleteDispatch = async (dispatchId: string) => {
    setDeletingDispatchId(dispatchId)
    try {
      const res = await fetch(`/api/campaigns/${id}/dispatches/${dispatchId}`, { method: 'DELETE' })
      if (res.ok) {
        setDispatches(prev => prev.filter(d => d.id !== dispatchId))
        setCampaign(prev => prev ? { ...prev, total_leads: Math.max(0, prev.total_leads - 1) } : prev)
      }
    } catch { /* silent */ }
    setDeletingDispatchId(null)
  }

  // ── Quick-select leads without dispatches ─────────────────────────────────
  const handleQuickSelect = async (limit: number) => {
    setQuickSelectLoading(limit)
    setQuickSelectInfo(null)
    setAddContactsError(null)
    try {
      const res = await fetch(`/api/campaigns/${id}/contacts?limit=${limit}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setAddContactsError(err.error ?? 'Erro ao buscar leads')
      } else {
        const data = await res.json() as { phones: string[]; total: number }
        if (data.phones.length === 0) {
          setQuickSelectInfo('Nenhum lead sem disparo encontrado')
        } else {
          setPhonesInput(data.phones.join('\n'))
          setQuickSelectInfo(`${data.total} lead${data.total !== 1 ? 's' : ''} sem disparo selecionado${data.total !== 1 ? 's' : ''}`)
        }
      }
    } catch { setAddContactsError('Erro de conexão') }
    setQuickSelectLoading(null)
  }

  // ── Add contacts ──────────────────────────────────────────────────────────
  const handleAddContacts = async () => {
    setAddingContacts(true)
    setAddContactsError(null)
    const phones = phonesInput
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(Boolean)

    if (!phones.length) {
      setAddContactsError('Informe ao menos um número')
      setAddingContacts(false)
      return
    }

    try {
      const res = await fetch(`/api/campaigns/${id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones }),
      })
      if (res.ok) {
        setPhonesInput('')
        setShowAddContacts(false)
        await loadData()
      } else {
        const err = await res.json() as { error?: string }
        setAddContactsError(err.error ?? 'Erro ao adicionar contatos')
      }
    } catch { setAddContactsError('Erro de conexão') }
    setAddingContacts(false)
  }

  // ── Edit campaign ─────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSavingEdit(true)
    const opt = INTERVAL_OPTIONS[editIntervalIdx]!
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          interval_min: opt.min,
          interval_max: opt.max,
          allowed_hours_start: editHoursStart,
          allowed_hours_end: editHoursEnd,
        }),
      })
      if (res.ok) {
        setShowEdit(false)
        await loadData()
      }
    } catch { /* silent */ }
    setSavingEdit(false)
  }

  // ── Delete campaign ───────────────────────────────────────────────────────
  const handleDeleteCampaign = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/disparos?tab=campanhas')
      }
    } catch { /* silent */ }
    setDeleting(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="px-8 py-7">
        <button onClick={() => router.push('/disparos')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-4">
          <ArrowLeft size={15} /> Voltar
        </button>
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    )
  }

  const isRunning    = campaign.status === 'running'
  const isEditable   = campaign.status === 'draft' || campaign.status === 'paused'
  const pending      = Math.max(0, campaign.total_leads - campaign.sent_count - campaign.failed_count)
  const progress     = campaign.total_leads > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_leads) * 100)
    : 0
  const avgInterval  = ((campaign.interval_min ?? 0) + (campaign.interval_max ?? 0)) / 2
  const activeCountdown = countdown ?? (localSec != null ? { remaining: localSec, total: localTotal } : null)

  // Estimated completion: now + pending × avgInterval minutes
  const estCompletionMs  = pending * avgInterval * 60 * 1000
  const estCompletionStr = estCompletionMs > 0
    ? (() => {
        const totalMin = Math.round(estCompletionMs / 60000)
        if (totalMin < 60) return `~${totalMin} min`
        return `~${Math.floor(totalMin / 60)}h ${totalMin % 60}min`
      })()
    : null

  const allowedStart = campaign.allowed_hours_start ?? 0
  const allowedEnd   = campaign.allowed_hours_end   ?? 23
  const currentHour  = new Date().getHours()
  const outsideHours = currentHour < allowedStart || currentHour > allowedEnd

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">

      {/* Back + header */}
      <div>
        <button onClick={() => router.push('/disparos')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-3">
          <ArrowLeft size={14} /> Disparos
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <StatusBadge status={campaign.status} running={isRunning} />
            </div>
            <p className="text-sm text-muted-foreground">
              Criado em {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {' · '}Intervalo: {campaign.interval_min}–{campaign.interval_max} min
              {allowedStart > 0 || allowedEnd < 23
                ? ` · Horário: ${allowedStart}h–${allowedEnd}h`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={loadData} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
            {/* Edit */}
            {!isRunning && (
              <button onClick={() => setShowEdit(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                <Settings size={13} /> Editar
              </button>
            )}
            {/* Add contacts */}
            {isEditable && (
              <button onClick={() => setShowAddContacts(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                <UserPlus size={13} /> Adicionar contatos
              </button>
            )}
            {/* Delete */}
            {!isRunning && (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 text-sm hover:bg-red-500/20 transition-colors cursor-pointer">
                <Trash2 size={13} /> Excluir
              </button>
            )}
            {/* Start */}
            {isEditable && (
              <button
                onClick={() => !outsideHours && handleAction('start')}
                disabled={actionLoading || outsideHours}
                title={outsideHours ? `Fora do horário. Disponível entre ${allowedStart}h e ${allowedEnd}h` : undefined}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50',
                  outsideHours ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-alliance-blue hover:bg-alliance-dark',
                )}
              >
                {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {campaign.status === 'paused' ? 'Retomar' : 'Iniciar'}
              </button>
            )}
            {isRunning && (
              <>
                <button onClick={() => handleAction('pause')} disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-600 text-sm font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer disabled:opacity-50">
                  <Pause size={14} /> Pausar
                </button>
                <button onClick={() => handleAction('stop')} disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-500 text-sm font-semibold hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50">
                  <Square size={14} /> Encerrar
                </button>
              </>
            )}
            {campaign.status === 'paused' && (
              <button onClick={() => handleAction('stop')} disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-500 text-sm font-semibold hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50">
                <Square size={14} /> Encerrar
              </button>
            )}
          </div>
        </div>
        {/* Action error */}
        {actionError && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500">
            <AlertTriangle size={14} /> {actionError}
          </div>
        )}
        {/* Outside hours warning when editable */}
        {outsideHours && isEditable && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-600 dark:text-amber-400">
            <Clock size={14} />
            Esta campanha só pode ser iniciada entre {allowedStart}h e {allowedEnd}h. Agora são {currentHour}h.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: campaign.total_leads,  color: 'text-foreground' },
          { label: 'Enviados',  value: campaign.sent_count,   color: 'text-green-600' },
          { label: 'Falhas',    value: campaign.failed_count, color: 'text-red-500' },
          { label: 'Pendentes', value: pending,               color: 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress + estimated completion */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">Progresso</p>
          <div className="flex items-center gap-3">
            {estCompletionStr && isRunning && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> Conclusão estimada: {estCompletionStr}
              </span>
            )}
            <p className="text-sm font-bold text-foreground">{progress}%</p>
          </div>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-alliance-blue rounded-full"
          />
        </div>
      </div>

      {/* Countdown timer — enlarged, shown when running */}
      {isRunning && activeCountdown && (
        <div className="bg-card border border-alliance-blue/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Em execução — próxima mensagem em</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-alliance-blue">
              {Math.floor(activeCountdown.remaining / 60) > 0
                ? `${Math.floor(activeCountdown.remaining / 60)}m ${String(activeCountdown.remaining % 60).padStart(2, '0')}s`
                : `${activeCountdown.remaining}s`}
            </p>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${(activeCountdown.remaining / Math.max(activeCountdown.total, 1)) * 100}%` }}
              transition={{ duration: 0.95, ease: 'linear' }}
              className="h-full bg-alliance-blue rounded-full"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">
              {countdown ? 'Sincronizado com o serviço de disparos' : 'Estimativa baseada no intervalo configurado'}
            </p>
            {estCompletionStr && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Timer size={10} /> Conclusão estimada: {estCompletionStr}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dispatches table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Envios ({dispatches.length})</h2>
        </div>
        {dispatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <MessageSquare size={28} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhum envio registrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delay</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado em</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map((d, idx) => {
                  const isEditing   = editingId === d.id
                  const isExpanded  = expandedIds.has(d.id)
                  const msg         = d.message_sent ?? ''
                  const isTruncated = msg.length > 80 && !isExpanded
                  const displayMsg  = isTruncated ? `${msg.slice(0, 80)}…` : msg
                  const estMinutes  = Math.round((idx + 1) * avgInterval)
                  const isDeleting  = deletingDispatchId === d.id

                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-4 py-3.5 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-foreground whitespace-nowrap">
                        {d.phone.replace('@s.whatsapp.net', '')}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full px-2 py-1.5 rounded-lg border border-alliance-blue/40 bg-background text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                          />
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {msg ? (
                              <>
                                <span className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{displayMsg}</span>
                                {msg.length > 80 && (
                                  <button onClick={() => toggleExpand(d.id)} className="text-[10px] text-alliance-blue hover:underline text-left cursor-pointer">
                                    {isExpanded ? 'ver menos' : 'ver mais'}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">sem mensagem</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {d.typing_delay != null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                            {(d.typing_delay / 1000).toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {d.status === 'pending' && avgInterval > 0 ? `~${estMinutes} min` : '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', DISPATCH_STATUS_STYLES[d.status] ?? DISPATCH_STATUS_STYLES.pending)}>
                          {DISPATCH_STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {d.sent_at ? format(new Date(d.sent_at), 'dd/MM HH:mm:ss', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => saveEdit(d.id)} disabled={saving}
                              className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50" title="Salvar">
                              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                            </button>
                            <button onClick={cancelEdit} disabled={saving}
                              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer" title="Cancelar">
                              <X size={11} />
                            </button>
                          </div>
                        ) : d.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(d)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground" title="Editar mensagem">
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteDispatch(d.id)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer text-muted-foreground hover:text-red-500 disabled:opacity-50"
                              title="Remover contato"
                            >
                              {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add contacts panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddContacts && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowAddContacts(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Adicionar contatos</h2>
                <button onClick={() => { setShowAddContacts(false); setPhonesInput(''); setQuickSelectInfo(null); setAddContactsError(null) }} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              {/* Quick select */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Selecionar leads sem disparo</span>
                </div>
                <div className="flex gap-2">
                  {[20, 30, 50].map(n => (
                    <button
                      key={n}
                      onClick={() => handleQuickSelect(n)}
                      disabled={quickSelectLoading !== null}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50',
                        quickSelectLoading === n
                          ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue'
                          : 'border-border text-muted-foreground hover:border-alliance-blue/40 hover:bg-alliance-blue/5 hover:text-alliance-blue',
                      )}
                    >
                      {quickSelectLoading === n
                        ? <RefreshCw size={11} className="animate-spin" />
                        : null}
                      {n} leads
                    </button>
                  ))}
                </div>
                {quickSelectInfo && (
                  <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <Check size={11} /> {quickSelectInfo}
                  </p>
                )}
              </div>

              <div className="h-px bg-border" />

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Ou informe números manualmente (um por linha)</label>
                <textarea
                  value={phonesInput}
                  onChange={e => { setPhonesInput(e.target.value); setQuickSelectInfo(null) }}
                  rows={6}
                  placeholder={'5511999999999\n5521988888888'}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                />
                <p className="text-[10px] text-muted-foreground">Formato: DDI + DDD + número (ex: 5511999999999)</p>
              </div>
              {addContactsError && (
                <p className="text-sm text-red-500 flex items-center gap-2"><AlertTriangle size={13} /> {addContactsError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAddContacts(false); setPhonesInput(''); setQuickSelectInfo(null); setAddContactsError(null) }} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleAddContacts} disabled={addingContacts || !phonesInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer disabled:opacity-50">
                  {addingContacts ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Adicionar {phonesInput.trim() ? `(${phonesInput.trim().split(/\n/).filter(Boolean).length})` : ''}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit campaign panel ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowEdit(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Editar campanha</h2>
                <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                  />
                </div>
                {/* Interval */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Intervalo entre envios</label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTERVAL_OPTIONS.map((opt, i) => (
                      <button key={i} onClick={() => setEditIntervalIdx(i)}
                        className={cn(
                          'px-3 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer',
                          editIntervalIdx === i
                            ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Allowed hours */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock size={11} /> Horário permitido para envio
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={editHoursStart}
                      onChange={e => setEditHoursStart(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                    >
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                    <span className="text-muted-foreground text-sm">até</span>
                    <select
                      value={editHoursEnd}
                      onChange={e => setEditHoursEnd(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                    >
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowEdit(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer disabled:opacity-50">
                  {savingEdit ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete campaign confirm ───────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-5 p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-foreground">Excluir campanha?</h2>
                <p className="text-sm text-muted-foreground">
                  A campanha <strong className="text-foreground">&quot;{campaign.name}&quot;</strong> e todos os seus {dispatches.length} envios serão excluídos permanentemente.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleDeleteCampaign} disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
                  {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Excluir definitivamente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
