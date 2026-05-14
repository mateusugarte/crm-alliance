'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Smartphone, Plus, RefreshCw, X, QrCode, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Database, WaInstance } from '@/lib/supabase/types'

const STATUS_STYLES: Record<string, string> = {
  connected:    'bg-green-500/15 text-green-600',
  disconnected: 'bg-muted text-muted-foreground',
  connecting:   'bg-amber-500/15 text-amber-500',
}

const STATUS_LABELS: Record<string, string> = {
  connected:    'Conectado',
  disconnected: 'Desconectado',
  connecting:   'Conectando',
}

function createSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.disconnected)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function InstanciasPage() {
  const [instances, setInstances] = useState<WaInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrData, setQrData] = useState<{ name: string; token: string; qr: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadInstances = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('wa_instances')
        .select('*')
        .order('created_at', { ascending: false })
      setInstances((data ?? []) as WaInstance[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const handleConnect = async () => {
    if (!newName.trim() || !newToken.trim()) return
    setConnecting(true)
    try {
      await disparoFetch('/api/instances/connect', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), instanceToken: newToken.trim() }),
      })
      setConnectModalOpen(false)
      setNewName('')
      setNewToken('')
      await loadInstances()
    } catch { /* silent */ }
    setConnecting(false)
  }

  const handleDelete = async (token: string) => {
    try {
      await disparoFetch(`/api/instances/${token}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      await loadInstances()
    } catch { /* silent */ }
  }

  const handleCheckStatus = async (token: string) => {
    try {
      await disparoFetch(`/api/instances/${token}/status`)
      await loadInstances()
    } catch { /* silent */ }
  }

  const handleShowQr = async (instance: WaInstance) => {
    setQrLoading(true)
    setQrData(null)
    setQrModalOpen(true)
    try {
      const res = await disparoFetch(`/api/instances/${instance.instance_id}/qrcode`)
      if (res.ok) {
        const data = await res.json() as { qr?: string; base64?: string }
        setQrData({ name: instance.name, token: instance.instance_id, qr: data.qr ?? data.base64 ?? '' })
      }
    } catch { /* silent */ }
    setQrLoading(false)
  }

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            WhatsApp
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Instâncias</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as instâncias do WhatsApp conectadas ao sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadInstances}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setConnectModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Conectar Nova Instância
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Instances grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Smartphone size={40} className="text-muted-foreground/20" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Nenhuma instância</p>
            <p className="text-xs text-muted-foreground mt-1">Conecte uma instância do WhatsApp para começar</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map(inst => (
            <div key={inst.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
              {/* Card header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{inst.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[140px]">
                      {inst.instance_id}
                    </p>
                  </div>
                </div>
                <StatusBadge status={inst.status} />
              </div>

              {/* Details */}
              <div className="flex flex-col gap-1.5 text-xs">
                {inst.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Telefone</span>
                    <span className="font-mono text-foreground">{inst.phone}</span>
                  </div>
                )}
                {inst.connected_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Conectado em</span>
                    <span className="text-foreground">
                      {format(new Date(inst.connected_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Criado em</span>
                  <span className="text-foreground">
                    {format(new Date(inst.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <button
                  onClick={() => handleCheckStatus(inst.instance_id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Verificar
                </button>
                {inst.status !== 'connected' && (
                  <button
                    onClick={() => handleShowQr(inst)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-alliance-blue hover:bg-alliance-blue/10 transition-colors cursor-pointer"
                  >
                    <QrCode size={12} />
                    QR Code
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirm(inst.instance_id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Delete confirm */}
              <AnimatePresence>
                {deleteConfirm === inst.instance_id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 pt-2 border-t border-border">
                      <p className="text-xs text-red-500 font-medium">Confirmar exclusão?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(inst.instance_id)}
                          className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          Excluir
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/70 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Connect modal */}
      <AnimatePresence>
        {connectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setConnectModalOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold text-foreground">Conectar Instância</h2>
                <button onClick={() => setConnectModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nome da instância
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ex: WhatsApp Principal"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Instance Token
                  </label>
                  <input
                    type="text"
                    value={newToken}
                    onChange={e => setNewToken(e.target.value)}
                    placeholder="token-da-instancia"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                <button
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!newName.trim() || !newToken.trim() || connecting}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                    newName.trim() && newToken.trim() && !connecting
                      ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  {connecting ? <><RefreshCw size={14} className="animate-spin" /> Conectando...</> : 'Conectar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR code modal */}
      <AnimatePresence>
        {qrModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setQrModalOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="text-base font-bold text-foreground">QR Code</h2>
                  {qrData && <p className="text-xs text-muted-foreground mt-0.5">{qrData.name}</p>}
                </div>
                <button onClick={() => setQrModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center gap-4">
                {qrLoading ? (
                  <div className="w-56 h-56 flex items-center justify-center">
                    <RefreshCw size={28} className="animate-spin text-muted-foreground" />
                  </div>
                ) : qrData?.qr ? (
                  <>
                    <div className="bg-white p-3 rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`}
                        alt="QR Code WhatsApp"
                        width={220}
                        height={220}
                        className="block"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Escaneie o QR code no WhatsApp para conectar esta instância
                    </p>
                  </>
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-2">
                    <QrCode size={32} className="text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">QR code indisponível</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
