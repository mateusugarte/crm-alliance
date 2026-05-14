'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw, Plus, X, ChevronRight, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Database, ReactivationCampaign, WaInstance } from '@/lib/supabase/types'

type Lead = Database['public']['Tables']['leads']['Row']

type LeadRow = Pick<Lead,
  'id' | 'name' | 'phone' | 'reactivation_count' | 'last_reactivated_at'
>

interface ReactivationStats {
  reengajados_1x: number
  reengajados_2x: number
  reengajados_3x: number
}

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

const INTERVAL_OPTIONS = [
  { label: '1–2 min', min: 1, max: 2 },
  { label: '2–5 min', min: 2, max: 5 },
  { label: '5–10 min', min: 5, max: 10 },
  { label: '10–20 min', min: 10, max: 20 },
]

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: '0×', value: '0' },
  { label: '1×', value: '1' },
  { label: '2×', value: '2' },
  { label: '3×', value: '3' },
]

function createSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.draft)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function ReativarPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<ReactivationCampaign[]>([])
  const [stats, setStats] = useState<ReactivationStats>({ reengajados_1x: 0, reengajados_2x: 0, reengajados_3x: 0 })
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(1)

  // Wizard state
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [filterReact, setFilterReact] = useState<string>('all')
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState(['', '', '', '', ''])
  const [intervalOption, setIntervalOption] = useState(1)
  const [instances, setInstances] = useState<WaInstance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [preparing, setPreparing] = useState(false)
  const [previewMessages, setPreviewMessages] = useState<string[]>([])
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await disparoFetch('/api/reactivation')
      if (res.ok) {
        const data = await res.json() as ReactivationCampaign[]
        setCampaigns(data)
      }
    } catch { /* silent */ }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await disparoFetch('/api/reactivation/stats')
      if (res.ok) {
        const data = await res.json() as ReactivationStats
        setStats(data)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    Promise.all([loadCampaigns(), loadStats()]).finally(() => setLoading(false))
  }, [loadCampaigns, loadStats])

  const openWizard = async () => {
    setStep(1)
    setSelectedLeads(new Set())
    setMessages(['', '', '', '', ''])
    setIntervalOption(1)
    setPreviewMessages([])
    setCreatedCampaignId(null)
    setWizardOpen(true)
    setLeadsLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('leads')
        .select('id, name, phone, reactivation_count, last_reactivated_at')
        .order('name', { ascending: true })
      setLeads((data ?? []) as LeadRow[])
    } catch { /* silent */ }
    setLeadsLoading(false)

    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('wa_instances')
        .select('*')
        .eq('status', 'connected')
      setInstances((data ?? []) as WaInstance[])
      if (data && data.length > 0) setSelectedInstance((data[0] as WaInstance).instance_id)
    } catch { /* silent */ }
  }

  const filteredLeads = leads.filter(l => {
    if (filterReact === 'all') return true
    return String(l.reactivation_count ?? 0) === filterReact
  })

  const toggleLead = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)))
    }
  }

  const handlePrepare = async () => {
    setPreparing(true)
    try {
      const opt = INTERVAL_OPTIONS[intervalOption]
      const selectedLeadObjects = leads.filter(l => selectedLeads.has(l.id))

      // Create campaign
      const createRes = await disparoFetch('/api/reactivation', {
        method: 'POST',
        body: JSON.stringify({
          name: `Reativação ${format(new Date(), 'dd/MM HH:mm', { locale: ptBR })}`,
          instance_id: selectedInstance,
          reference_messages: messages.filter(m => m.trim()),
          interval_min: opt.min,
          interval_max: opt.max,
          leads: selectedLeadObjects.map(l => ({ lead_id: l.id, phone: l.phone })),
        }),
      })

      if (!createRes.ok) {
        setPreparing(false)
        return
      }

      const created = await createRes.json() as { id: string }
      setCreatedCampaignId(created.id)

      // Prepare (AI generates messages)
      const prepRes = await disparoFetch(`/api/reactivation/${created.id}/prepare`, { method: 'POST' })
      if (prepRes.ok) {
        const prepData = await prepRes.json() as { preview?: string[] }
        setPreviewMessages(prepData.preview ?? [])
      }
    } catch { /* silent */ }
    setPreparing(false)
  }

  const handleStart = async () => {
    if (!createdCampaignId) return
    setStarting(true)
    try {
      const res = await disparoFetch(`/api/reactivation/${createdCampaignId}/start`, { method: 'POST' })
      if (res.ok) {
        setWizardOpen(false)
        router.push(`/reativar/${createdCampaignId}`)
      }
    } catch { /* silent */ }
    setStarting(false)
  }

  const canGoStep2 = selectedLeads.size > 0
  const canGoStep3 = messages.filter(m => m.trim()).length >= 1
  const canPrepare = selectedInstance && canGoStep3

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Sistema de Reativação
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Reativar Leads</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); Promise.all([loadCampaigns(), loadStats()]).finally(() => setLoading(false)) }}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button
            onClick={openWizard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Disparar
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Reengajados 1×', value: stats.reengajados_1x },
          { label: 'Reengajados 2×', value: stats.reengajados_2x },
          { label: 'Reengajados 3×', value: stats.reengajados_3x },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Campaigns table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Campanhas de Reativação</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <RefreshCw size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda</p>
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
                  onClick={() => router.push(`/reativar/${c.id}`)}
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

      {/* Wizard Modal */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setWizardOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-foreground">Nova Reativação</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Passo {step} de 3 — {step === 1 ? 'Selecionar contatos' : step === 2 ? 'Mensagens de referência' : 'Configurar envio'}
                  </p>
                </div>
                <button
                  onClick={() => setWizardOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      step === s ? 'bg-alliance-blue text-white' : step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
                    )}>
                      {step > s ? <Check size={12} /> : s}
                    </div>
                    {s < 3 && <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Step 1: Select contacts */}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    {/* Warning banner */}
                    <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Recomendamos disparar para no máximo 10 contatos a cada 4 horas para evitar bloqueios.
                      </p>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex gap-2">
                      {FILTER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setFilterReact(opt.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                            filterReact === opt.value
                              ? 'bg-alliance-blue text-white'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground self-center">
                        {selectedLeads.size} selecionado{selectedLeads.size !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {selectedLeads.size > 10 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle size={13} className="text-red-500" />
                        <p className="text-xs text-red-500">Mais de 10 contatos selecionados. Risco elevado de bloqueio.</p>
                      </div>
                    )}

                    {/* Table */}
                    {leadsLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="px-4 py-2.5 w-10">
                                <input
                                  type="checkbox"
                                  checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                                  onChange={toggleAll}
                                  className="cursor-pointer"
                                />
                              </th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Nome</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Telefone</th>
                              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Reativações</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Última vez</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredLeads.map(lead => (
                              <tr
                                key={lead.id}
                                onClick={() => toggleLead(lead.id)}
                                className="hover:bg-muted/30 transition-colors cursor-pointer"
                              >
                                <td className="px-4 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedLeads.has(lead.id)}
                                    onChange={() => toggleLead(lead.id)}
                                    onClick={e => e.stopPropagation()}
                                    className="cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2.5 font-medium text-foreground">{lead.name}</td>
                                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{lead.phone}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{lead.reactivation_count ?? 0}×</td>
                                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                  {lead.last_reactivated_at
                                    ? format(new Date(lead.last_reactivated_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                  Nenhum lead encontrado
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Reference messages */}
                {step === 2 && (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Escreva até 5 mensagens de referência. A IA vai usá-las para gerar variações personalizadas para cada lead.
                    </p>
                    {messages.map((msg, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Mensagem {i + 1} {i === 0 && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          value={msg}
                          onChange={e => {
                            const next = [...messages]
                            next[i] = e.target.value
                            setMessages(next)
                          }}
                          rows={3}
                          placeholder={i === 0 ? 'Escreva a mensagem principal...' : 'Variação opcional...'}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 3: Configure */}
                {step === 3 && (
                  <div className="flex flex-col gap-5">
                    {/* Interval */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Intervalo entre mensagens
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {INTERVAL_OPTIONS.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => setIntervalOption(i)}
                            className={cn(
                              'px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left cursor-pointer',
                              intervalOption === i
                                ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue'
                                : 'border-border bg-card text-foreground hover:bg-muted',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Instance */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Instância WhatsApp
                      </label>
                      {instances.length === 0 ? (
                        <p className="text-sm text-red-500">Nenhuma instância conectada. Conecte uma em /instancias.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {instances.map(inst => (
                            <button
                              key={inst.id}
                              onClick={() => setSelectedInstance(inst.instance_id)}
                              className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors cursor-pointer',
                                selectedInstance === inst.instance_id
                                  ? 'border-alliance-blue bg-alliance-blue/10'
                                  : 'border-border bg-card hover:bg-muted',
                              )}
                            >
                              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-foreground">{inst.name}</p>
                                {inst.phone && <p className="text-xs text-muted-foreground">{inst.phone}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Prepare button */}
                    {previewMessages.length === 0 && (
                      <button
                        onClick={handlePrepare}
                        disabled={!canPrepare || preparing}
                        className={cn(
                          'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                          canPrepare && !preparing
                            ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                            : 'bg-muted text-muted-foreground cursor-not-allowed',
                        )}
                      >
                        {preparing ? (
                          <><RefreshCw size={14} className="animate-spin" /> Preparando com IA...</>
                        ) : (
                          'Preparar Reativação'
                        )}
                      </button>
                    )}

                    {/* Preview */}
                    {previewMessages.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Preview das mensagens geradas
                        </p>
                        {previewMessages.slice(0, 3).map((msg, i) => (
                          <div key={i} className="px-4 py-3 bg-muted/50 rounded-xl border border-border">
                            <p className="text-xs text-muted-foreground mb-1">Lead {i + 1}</p>
                            <p className="text-sm text-foreground">{msg}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
                <button
                  onClick={() => step > 1 ? setStep(s => s - 1) : setWizardOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  {step === 1 ? 'Cancelar' : 'Voltar'}
                </button>

                {step < 3 ? (
                  <button
                    onClick={() => setStep(s => s + 1)}
                    disabled={step === 1 ? !canGoStep2 : !canGoStep3}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                      (step === 1 ? canGoStep2 : canGoStep3)
                        ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                        : 'bg-muted text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    Próximo <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={previewMessages.length === 0 || starting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                      previewMessages.length > 0 && !starting
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-muted text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    {starting ? (
                      <><RefreshCw size={14} className="animate-spin" /> Iniciando...</>
                    ) : (
                      'Confirmar e Iniciar'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
