'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, RefreshCw, Play, Pause, Square, AlertTriangle, Settings, Pencil, Check, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { ReactivationCampaign, ReactivationDispatch } from '@/lib/supabase/types'

const INTERVAL_OPTIONS = [
  { label: '1–2 min', min: 1, max: 2 },
  { label: '2–5 min', min: 2, max: 5 },
  { label: '5–10 min', min: 5, max: 10 },
  { label: '10–20 min', min: 10, max: 20 },
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ── Status maps ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  running:   'bg-blue-500/15 text-blue-500',
  paused:    'bg-amber-500/15 text-amber-500',
  completed: 'bg-green-500/15 text-green-600',
  cancelled: 'bg-red-500/15 text-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  running:   'Executando',
  paused:    'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const DISPATCH_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-muted text-muted-foreground',
  sent:      'bg-green-500/15 text-green-600',
  failed:    'bg-red-500/15 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
}

const DISPATCH_STATUS_LABELS: Record<string, string> = {
  pending:   'Pendente',
  sent:      'Enviado',
  failed:    'Falhou',
  cancelled: 'Cancelado',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReactivationDetail extends ReactivationCampaign {
  dispatches?: ReactivationDispatch[]
}

interface CountdownState {
  remaining: number
  total: number
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.draft)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReativarDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<ReactivationDetail | null>(null)
  const [dispatches, setDispatches] = useState<ReactivationDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null)

  // Inline message edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit campaign panel
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editIntervalIdx, setEditIntervalIdx] = useState(1)
  const [editHoursStart, setEditHoursStart] = useState(0)
  const [editHoursEnd, setEditHoursEnd] = useState(23)
  const [savingEdit, setSavingEdit] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await disparoFetch(`/api/reactivation/${id}`)
      if (res.ok) {
        const data = await res.json() as ReactivationDetail
        setCampaign(data)
        setDispatches(data.dispatches ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync edit state when campaign loads
  useEffect(() => {
    if (!campaign) return
    setEditName(campaign.name)
    const idx = INTERVAL_OPTIONS.findIndex(o => o.min === campaign.interval_min && o.max === campaign.interval_max)
    setEditIntervalIdx(idx >= 0 ? idx : 1)
    setEditHoursStart(campaign.allowed_hours_start ?? 0)
    setEditHoursEnd(campaign.allowed_hours_end ?? 23)
  }, [campaign])

  // Socket.io — only connect when running
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // O socket precisa do processo persistente do server.js (EasyPanel) — em deploys
    // serverless (Vercel), NEXT_PUBLIC_DISPARO_SOCKET_URL aponta pra lá diretamente.
    // Sem essa variável, conecta na própria origem (é o que o EasyPanel já é).
    const apiUrl = process.env.NEXT_PUBLIC_DISPARO_SOCKET_URL || undefined

    import('socket.io-client').then(({ io }) => {
      const socket = io(apiUrl, { transports: ['websocket'] })
      socketRef.current = socket

      socket.on('reactivation:dispatch:sent', (payload: { campaignId: string; dispatchId: string; phone: string; message: string }) => {
        if (payload.campaignId !== id) return
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatchId
            ? { ...d, status: 'sent', message_sent: payload.message, sent_at: new Date().toISOString() }
            : d
        ))
        setCampaign(prev => prev ? { ...prev, sent_count: prev.sent_count + 1 } : prev)
      })

      socket.on('reactivation:dispatch:failed', (payload: { campaignId: string; dispatchId: string; phone: string; error: string }) => {
        if (payload.campaignId !== id) return
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatchId
            ? { ...d, status: 'failed', error: payload.error ?? null }
            : d
        ))
        setCampaign(prev => prev ? { ...prev, failed_count: prev.failed_count + 1 } : prev)
      })

      socket.on('reactivation:countdown', (payload: { campaignId: string; remaining: number; total: number }) => {
        if (payload.campaignId !== id) return
        // O motor emite remaining/total em milissegundos — convertemos pra segundos aqui,
        // uma única vez, pra quem exibe não precisar saber da unidade original.
        setCountdown({ remaining: Math.round(payload.remaining / 1000), total: Math.round(payload.total / 1000) })
      })

      socket.on('reactivation:completed', (payload?: { campaignId?: string }) => {
        if (payload?.campaignId && payload.campaignId !== id) return
        setCountdown(null)
        loadData()
      })

      socket.on('reactivation:paused', (payload?: { campaignId?: string }) => {
        if (payload?.campaignId && payload.campaignId !== id) return
        setCountdown(null)
        loadData()
      })

      socket.on('reactivation:stopped', (payload?: { campaignId?: string }) => {
        if (payload?.campaignId && payload.campaignId !== id) return
        setCountdown(null)
        loadData()
      })
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [campaign?.status, id, loadData])

  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    if (!campaign) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await disparoFetch(`/api/reactivation/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setActionError(err.error ?? 'Erro ao executar ação')
      } else {
        await loadData()
      }
    } catch {
      setActionError('Erro de conexão')
    }
    setActionLoading(false)
  }

  // ── Inline message edit ─────────────────────────────────────────────────
  const startEdit = (d: ReactivationDispatch) => { setEditingId(d.id); setEditValue(d.message_sent ?? '') }
  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const saveEdit = async (dispatchId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/reactivation/${id}/dispatches/${dispatchId}`, {
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

  // ── Edit campaign ─────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSavingEdit(true)
    const opt = INTERVAL_OPTIONS[editIntervalIdx]!
    try {
      const res = await fetch(`/api/reactivation/${id}`, {
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
        <button
          onClick={() => router.push('/disparos?tab=reativar')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-4"
        >
          <ArrowLeft size={15} /> Reativar
        </button>
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    )
  }

  const pending = Math.max(0, campaign.total_leads - campaign.sent_count - campaign.failed_count)
  const progress = campaign.total_leads > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_leads) * 100)
    : 0

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push('/disparos?tab=reativar')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-3"
        >
          <ArrowLeft size={14} /> Reativar
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Criado em {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {' · '}Intervalo: {campaign.interval_min}–{campaign.interval_max} min
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
              title="Atualizar"
            >
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
            {campaign.status !== 'running' && (
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Settings size={13} /> Editar
              </button>
            )}
            {(campaign.status === 'draft' || campaign.status === 'paused') && (
              <button
                onClick={() => handleAction('start')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play size={14} />
                {campaign.status === 'paused' ? 'Retomar' : 'Iniciar'}
              </button>
            )}
            {campaign.status === 'running' && (
              <>
                <button
                  onClick={() => handleAction('pause')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-600 text-sm font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Pause size={14} /> Pausar
                </button>
                <button
                  onClick={() => handleAction('stop')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-500 text-sm font-semibold hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Square size={14} /> Encerrar
                </button>
              </>
            )}
            {campaign.status === 'paused' && (
              <button
                onClick={() => handleAction('stop')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-500 text-sm font-semibold hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50"
              >
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
      </div>

      {/* Stats cards */}
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

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">Progresso</p>
          <p className="text-sm font-bold text-foreground">{progress}%</p>
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

      {/* Countdown bar (when running) */}
      {countdown && campaign.status === 'running' && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Próximo envio em</p>
            <p className="text-sm font-bold text-alliance-blue">
              {Math.floor(countdown.remaining / 60) > 0
                ? `${Math.floor(countdown.remaining / 60)}m ${String(countdown.remaining % 60).padStart(2, '0')}s`
                : `${countdown.remaining}s`}
            </p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${(countdown.remaining / Math.max(countdown.total, 1)) * 100}%` }}
              transition={{ duration: 0.9 }}
              className="h-full bg-alliance-blue/40 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Dispatches table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Envios ({dispatches.length})</h2>
        </div>
        {dispatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Nenhum envio registrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem enviada</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado em</th>
                  <th className="w-16 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map(d => {
                  const isEditing = editingId === d.id
                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-5 py-3.5 font-mono text-xs text-foreground whitespace-nowrap">{d.phone}</td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full px-2 py-1.5 rounded-lg border border-alliance-blue/40 bg-background text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                          />
                        ) : d.message_sent ? (
                          d.message_sent.length > 90 ? `${d.message_sent.slice(0, 90)}…` : d.message_sent
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', DISPATCH_STATUS_STYLES[d.status] ?? DISPATCH_STATUS_STYLES.pending)}>
                          {DISPATCH_STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {d.sent_at ? format(new Date(d.sent_at), 'dd/MM HH:mm:ss', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
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
                          <button onClick={() => startEdit(d)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground" title="Editar mensagem">
                            <Pencil size={12} />
                          </button>
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
    </div>
  )
}
