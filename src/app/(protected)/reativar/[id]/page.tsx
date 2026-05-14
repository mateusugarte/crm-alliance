'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, RefreshCw, Play, Pause, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { ReactivationCampaign, ReactivationDispatch } from '@/lib/supabase/types'

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
  pending: 'bg-muted text-muted-foreground',
  sent:    'bg-green-500/15 text-green-600',
  failed:  'bg-red-500/15 text-red-500',
}

interface CampaignDetail extends ReactivationCampaign {
  dispatches?: ReactivationDispatch[]
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

export default function ReativarDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [dispatches, setDispatches] = useState<ReactivationDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await disparoFetch(`/api/reactivation/${id}`)
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

      socket.on(`reactivation:dispatch:sent`, (payload: { dispatch_id: string }) => {
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatch_id ? { ...d, status: 'sent', sent_at: new Date().toISOString() } : d
        ))
        setCampaign(prev => prev ? { ...prev, sent_count: prev.sent_count + 1 } : prev)
      })

      socket.on(`reactivation:dispatch:failed`, (payload: { dispatch_id: string; error?: string }) => {
        setDispatches(prev => prev.map(d =>
          d.id === payload.dispatch_id ? { ...d, status: 'failed', error: payload.error ?? null } : d
        ))
        setCampaign(prev => prev ? { ...prev, failed_count: prev.failed_count + 1 } : prev)
      })

      socket.on(`reactivation:countdown`, (payload: { remaining: number; total: number }) => {
        setCountdown({ remaining: payload.remaining, total: payload.total })
      })

      socket.on('reactivation:completed', () => {
        setCountdown(null)
        loadData()
      })

      socket.on('reactivation:paused', () => {
        setCountdown(null)
        loadData()
      })

      socket.on('reactivation:stopped', () => {
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
      await disparoFetch(`/api/reactivation/${id}/${action}`, { method: 'POST' })
      await loadData()
    } catch { /* silent */ }
    setActionLoading(false)
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
        <button onClick={() => router.push('/reativar')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-4">
          <ArrowLeft size={15} /> Voltar
        </button>
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    )
  }

  const pending = campaign.total_leads - campaign.sent_count - campaign.failed_count
  const progress = campaign.total_leads > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_leads) * 100)
    : 0

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push('/reativar')}
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
          { label: 'Pendentes', value: Math.max(0, pending), color: 'text-muted-foreground' },
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
            <p className="text-sm text-muted-foreground">Nenhum envio registrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem enviada</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delay</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map(d => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-foreground">{d.phone}</td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-xs">
                      {d.message_sent
                        ? d.message_sent.length > 90
                          ? `${d.message_sent.slice(0, 90)}…`
                          : d.message_sent
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground text-xs">
                      {d.typing_delay ? `${d.typing_delay}s` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', DISPATCH_STATUS_STYLES[d.status] ?? DISPATCH_STATUS_STYLES.pending)}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      {d.sent_at ? format(new Date(d.sent_at), 'dd/MM HH:mm:ss', { locale: ptBR }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
