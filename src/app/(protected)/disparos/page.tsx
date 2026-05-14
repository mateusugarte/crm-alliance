'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Send, RefreshCw, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Campaign } from '@/lib/supabase/types'

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      STATUS_STYLES[status] ?? STATUS_STYLES.draft,
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function DisparosPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await disparoFetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json() as Campaign[]
        setCampaigns(data)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Sistema de Disparos
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Disparos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campanhas de prospecção em massa
          </p>
        </div>
        <button
          onClick={loadCampaigns}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
          title="Atualizar"
        >
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-500/8 border border-blue-500/15 rounded-xl">
        <Info size={15} className="text-alliance-blue flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          A criação de campanhas de disparo é feita pelo painel do backend.
          Aqui você acompanha o andamento e os resultados de cada campanha.
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Campanhas</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} encontrada{campaigns.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Send size={36} className="text-muted-foreground/20" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Nenhuma campanha</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie campanhas pelo painel do backend para vê-las aqui
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviados</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Falhas</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/disparos/${c.id}`)}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 font-medium text-foreground">{c.name}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5 text-right text-muted-foreground">{c.total_leads}</td>
                  <td className="px-5 py-3.5 text-right text-green-600">{c.sent_count}</td>
                  <td className="px-5 py-3.5 text-right text-red-500">{c.failed_count}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
