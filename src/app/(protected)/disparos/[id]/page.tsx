'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, RefreshCw, Play, Pause, Square,
  Pencil, Check, X, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Campaign, Dispatch } from '@/lib/supabase/types'

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

interface CampaignDetail extends Campaign {
  dispatches?: Dispatch[]
}

interface CountdownState {
  remaining: number
  total: number
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.draft)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function DisparoDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Expanded message rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null)

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

  useEffect(() => {
    loadData()
  }, [loadData])

  // Socket.io — only connect when running
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
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

      socket.on('campaign:completed', () => {
        setCountdown(null)
        loadData()
      })

      socket.on('campaign:paused', () => {
        setCountdown(null)
        loadData()
      })

      socket.on('campaign:stopped', () => {
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
  }, [campaign?.status, loadData])

  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    if (!campaign) return
    setActionLoading(true)
    try {
      await fetch(`/api/campaigns/${id}/${action}`, { method: 'POST' })
      await loadData()
    } catch { /* silent */ }
    setActionLoading(false)
  }

  const startEdit = (d: Dispatch) => {
    setEditingId(d.id)
    setEditValue(d.message_sent ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
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
        <button onClick={() => router.push('/disparos')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-4">
          <ArrowLeft size={15} /> Voltar
        </button>
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    )
  }

  const pending = Math.max(0, campaign.total_leads - campaign.sent_count - campaign.failed_count)
  const progress = campaign.total_leads > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_leads) * 100)
    : 0

  // Estimativa de tempo médio por dispatch (em minutos)
  const avgInterval = ((campaign.interval_min ?? 0) + (campaign.interval_max ?? 0)) / 2

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push('/disparos')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-3"
        >
          <ArrowLeft size={14} /> Disparos
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
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaign.total_leads, color: 'text-foreground' },
          { label: 'Enviados', value: campaign.sent_count, color: 'text-green-600' },
          { label: 'Falhas', value: campaign.failed_count, color: 'text-red-500' },
          { label: 'Pendentes', value: pending, color: 'text-muted-foreground' },
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
            <p className="text-sm font-bold text-alliance-blue">{countdown.remaining}s</p>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado em</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. tempo</th>
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map((d, idx) => {
                  const isEditing = editingId === d.id
                  const isExpanded = expandedIds.has(d.id)
                  const msg = d.message_sent ?? ''
                  const isTruncated = msg.length > 80 && !isExpanded
                  const displayMsg = isTruncated ? `${msg.slice(0, 80)}…` : msg
                  const estMinutes = Math.round((idx + 1) * avgInterval)

                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-4 py-3.5 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-foreground whitespace-nowrap">{d.phone}</td>
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
                                <span className="text-xs text-foreground leading-relaxed">{displayMsg}</span>
                                {msg.length > 80 && (
                                  <button
                                    onClick={() => toggleExpand(d.id)}
                                    className="text-[10px] text-alliance-blue hover:underline text-left cursor-pointer"
                                  >
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
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', DISPATCH_STATUS_STYLES[d.status] ?? DISPATCH_STATUS_STYLES.pending)}>
                          {DISPATCH_STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {d.sent_at ? format(new Date(d.sent_at), 'dd/MM HH:mm:ss', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {d.status === 'pending' && avgInterval > 0
                          ? `~${estMinutes} min`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(d.id)}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50"
                              title="Salvar"
                            >
                              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                              title="Cancelar"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          d.status === 'pending' && (
                            <button
                              onClick={() => startEdit(d)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                              title="Editar mensagem"
                            >
                              <Pencil size={12} />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
