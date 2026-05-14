'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  RefreshCw, Plus, X, ChevronRight, AlertTriangle, Check,
  Send, Smartphone, FileText, QrCode, Trash2, Pencil, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Database, ReactivationCampaign, WaInstance, Campaign, Template } from '@/lib/supabase/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Lead = Database['public']['Tables']['leads']['Row']
type LeadRow = Pick<Lead, 'id' | 'name' | 'phone' | 'reactivation_count' | 'last_reactivated_at'>

interface ReactivationStats { once: number; twice: number; thrice: number }
interface FormState { name: string; content: string; media_url: string; media_type: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'reativar',   label: 'Reativar',   icon: RefreshCw },
  { id: 'campanhas',  label: 'Campanhas',  icon: Send },
  { id: 'instancias', label: 'Instâncias', icon: Smartphone },
  { id: 'templates',  label: 'Templates',  icon: FileText },
] as const

type TabId = typeof TABS[number]['id']

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
const INST_STATUS_STYLES: Record<string, string> = {
  connected: 'bg-green-500/15 text-green-600',
  disconnected: 'bg-muted text-muted-foreground',
  connecting: 'bg-amber-500/15 text-amber-500',
}
const INST_STATUS_LABELS: Record<string, string> = {
  connected: 'Conectado', disconnected: 'Desconectado', connecting: 'Conectando',
}
const INTERVAL_OPTIONS = [
  { label: '1–2 min', min: 1, max: 2 },
  { label: '2–5 min', min: 2, max: 5 },
  { label: '5–10 min', min: 5, max: 10 },
  { label: '10–20 min', min: 10, max: 20 },
]
const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Imagem', video: 'Vídeo', document: 'Documento',
}
const EMPTY_FORM: FormState = { name: '', content: '', media_url: '', media_type: 'image' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function createSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function StatusBadge({ status, map = { styles: STATUS_STYLES, labels: STATUS_LABELS } }: {
  status: string
  map?: { styles: Record<string, string>; labels: Record<string, string> }
}) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map.styles[status] ?? map.styles.draft)}>
      {map.labels[status] ?? status}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DisparosPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState<TabId>(() => {
    const t = params.get('tab') as TabId | null
    return TABS.some(x => x.id === t) ? t! : 'reativar'
  })

  const switchTab = (id: TabId) => {
    setTab(id)
    router.replace(`/disparos?tab=${id}`, { scroll: false })
  }

  return (
    <div className="px-8 py-7 flex flex-col gap-0 min-h-full max-w-screen-xl">
      {/* Page header */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
          Sistema de Disparos
        </p>
        <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Disparos</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
              tab === id
                ? 'border-alliance-blue text-alliance-blue'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'reativar'   && <TabReativar   router={router} />}
      {tab === 'campanhas'  && <TabCampanhas  router={router} />}
      {tab === 'instancias' && <TabInstancias />}
      {tab === 'templates'  && <TabTemplates />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: REATIVAR
// ════════════════════════════════════════════════════════════════════════════

function TabReativar({ router }: { router: ReturnType<typeof useRouter> }) {
  const [campaigns, setCampaigns] = useState<ReactivationCampaign[]>([])
  const [stats, setStats] = useState<ReactivationStats>({ once: 0, twice: 0, thrice: 0 })
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
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [previewMessages, setPreviewMessages] = useState<string[]>([])
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, campRes] = await Promise.all([
        disparoFetch('/api/reactivation/stats').then(r => r.ok ? r.json() : null),
        disparoFetch('/api/reactivation').then(r => r.ok ? r.json() : []),
      ])
      if (statsRes) setStats(statsRes as ReactivationStats)
      setCampaigns(Array.isArray(campRes) ? campRes as ReactivationCampaign[] : [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const openWizard = async () => {
    setStep(1); setSelectedLeads(new Set()); setMessages(['', '', '', '', ''])
    setIntervalOption(1); setPreviewMessages([]); setCreatedCampaignId(null)
    setPrepareError(null); setWizardOpen(true); setLeadsLoading(true)
    const supabase = createSupabase()
    const [{ data: leadsData }, { data: instData }] = await Promise.all([
      supabase.from('leads').select('id, name, phone, reactivation_count, last_reactivated_at').order('name'),
      supabase.from('wa_instances').select('*').eq('status', 'connected'),
    ])
    setLeads((leadsData ?? []) as LeadRow[])
    const insts = (instData ?? []) as WaInstance[]
    setInstances(insts)
    if (insts.length) setSelectedInstance(insts[0].instance_id)
    setLeadsLoading(false)
  }

  const filteredLeads = leads.filter(l =>
    filterReact === 'all' ? true : String(l.reactivation_count ?? 0) === filterReact
  )
  const toggleLead = (id: string) => setSelectedLeads(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => setSelectedLeads(
    selectedLeads.size === filteredLeads.length ? new Set() : new Set(filteredLeads.map(l => l.id))
  )

  const handlePrepare = async () => {
    setPreparing(true); setPrepareError(null)
    try {
      const opt = INTERVAL_OPTIONS[intervalOption]
      const selectedLeadObjects = leads.filter(l => selectedLeads.has(l.id))
      const createRes = await disparoFetch('/api/reactivation', {
        method: 'POST',
        body: JSON.stringify({
          name: `Reativação ${format(new Date(), 'dd/MM HH:mm', { locale: ptBR })}`,
          instance_id: selectedInstance,
          reference_messages: messages.filter(m => m.trim()),
          interval_min: opt.min,
          interval_max: opt.max,
          contacts: selectedLeadObjects.map(l => ({ id: l.id, phone: l.phone })),
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json() as { error?: string }
        setPrepareError(err.error ?? 'Erro ao criar campanha')
        setPreparing(false); return
      }
      const created = await createRes.json() as { id: string }
      setCreatedCampaignId(created.id)
      const prepRes = await disparoFetch(`/api/reactivation/${created.id}/prepare`, { method: 'POST' })
      if (!prepRes.ok) {
        const err = await prepRes.json() as { error?: string }
        setPrepareError(err.error ?? 'Erro ao preparar mensagens')
      } else {
        const prepData = await prepRes.json() as { preview?: string[] }
        setPreviewMessages(prepData.preview ?? [])
      }
    } catch (e: unknown) {
      setPrepareError(e instanceof Error ? e.message : 'Erro desconhecido')
    }
    setPreparing(false)
  }

  const handleStart = async () => {
    if (!createdCampaignId) return
    setStarting(true)
    try {
      const res = await disparoFetch(`/api/reactivation/${createdCampaignId}/start`, { method: 'POST' })
      if (res.ok) { setWizardOpen(false); router.push(`/reativar/${createdCampaignId}`) }
    } catch { /* silent */ }
    setStarting(false)
  }

  const canGoStep2 = selectedLeads.size > 0
  const canGoStep3 = messages.filter(m => m.trim()).length >= 1
  const canPrepare = !!selectedInstance && canGoStep3

  return (
    <div className="flex flex-col gap-6">
      {/* Stats + action */}
      <div className="flex items-end justify-between gap-4">
        <div className="grid grid-cols-3 gap-4 flex-1">
          {[
            { label: 'Reengajados 1×', value: stats.once },
            { label: 'Reengajados 2×', value: stats.twice },
            { label: 'Reengajados 3×', value: stats.thrice },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-bold text-foreground">{loading ? '—' : value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <button onClick={loadAll} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
            <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button onClick={openWizard} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer">
            <Plus size={15} /> Disparar
          </button>
        </div>
      </div>

      {/* Campaigns table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Campanhas de Reativação</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <RefreshCw size={32} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Nome', 'Status', 'Total', 'Enviados', 'Falhas', 'Data'].map((h, i) => (
                  <th key={h} className={cn('px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider', i >= 2 && i <= 4 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map(c => (
                <tr key={c.id} onClick={() => router.push(`/reativar/${c.id}`)} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 font-medium text-foreground">{c.name}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5 text-right text-muted-foreground">{c.total_leads}</td>
                  <td className="px-5 py-3.5 text-right text-green-600">{c.sent_count}</td>
                  <td className="px-5 py-3.5 text-right text-red-500">{c.failed_count}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Wizard Modal */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setWizardOpen(false) }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
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
                <button onClick={() => setWizardOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      step === s ? 'bg-alliance-blue text-white' : step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground')}>
                      {step > s ? <Check size={12} /> : s}
                    </div>
                    {s < 3 && <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Step 1 */}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">Recomendamos no máximo 10 contatos a cada 4 horas para evitar bloqueios.</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {['all', '0', '1', '2', '3'].map(v => (
                        <button key={v} onClick={() => setFilterReact(v)}
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                            filterReact === v ? 'bg-alliance-blue text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
                          {v === 'all' ? 'Todos' : `${v}×`}
                        </button>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground self-center">{selectedLeads.size} selecionado{selectedLeads.size !== 1 ? 's' : ''}</span>
                    </div>
                    {selectedLeads.size > 10 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle size={13} className="text-red-500" />
                        <p className="text-xs text-red-500">Mais de 10 contatos. Risco elevado de bloqueio.</p>
                      </div>
                    )}
                    {leadsLoading ? (
                      <div className="flex items-center justify-center py-10"><RefreshCw size={18} className="animate-spin text-muted-foreground" /></div>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="px-4 py-2.5 w-10">
                                <input type="checkbox" checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length} onChange={toggleAll} className="cursor-pointer" />
                              </th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Nome</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Telefone</th>
                              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Reativações</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Última vez</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredLeads.map(lead => (
                              <tr key={lead.id} onClick={() => toggleLead(lead.id)} className="hover:bg-muted/30 transition-colors cursor-pointer">
                                <td className="px-4 py-2.5">
                                  <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleLead(lead.id)} onClick={e => e.stopPropagation()} className="cursor-pointer" />
                                </td>
                                <td className="px-4 py-2.5 font-medium text-foreground">{lead.name}</td>
                                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{lead.phone}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{lead.reactivation_count ?? 0}×</td>
                                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                  {lead.last_reactivated_at ? format(new Date(lead.last_reactivated_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                                </td>
                              </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhum lead encontrado</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">Escreva até 5 mensagens de referência. A IA vai usá-las para gerar variações personalizadas para cada lead.</p>
                    {messages.map((msg, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Mensagem {i + 1} {i === 0 && <span className="text-red-500">*</span>}
                        </label>
                        <textarea value={msg} onChange={e => { const n = [...messages]; n[i] = e.target.value; setMessages(n) }} rows={3}
                          placeholder={i === 0 ? 'Escreva a mensagem principal...' : 'Variação opcional...'}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intervalo entre mensagens</label>
                      <div className="grid grid-cols-2 gap-2">
                        {INTERVAL_OPTIONS.map((opt, i) => (
                          <button key={i} onClick={() => setIntervalOption(i)}
                            className={cn('px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left cursor-pointer',
                              intervalOption === i ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue' : 'border-border bg-card text-foreground hover:bg-muted')}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instância WhatsApp</label>
                      {instances.length === 0 ? (
                        <p className="text-sm text-red-500">Nenhuma instância conectada. Conecte uma na aba Instâncias.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {instances.map(inst => (
                            <button key={inst.id} onClick={() => setSelectedInstance(inst.instance_id)}
                              className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors cursor-pointer',
                                selectedInstance === inst.instance_id ? 'border-alliance-blue bg-alliance-blue/10' : 'border-border bg-card hover:bg-muted')}>
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
                    {previewMessages.length === 0 && !prepareError && (
                      <button onClick={handlePrepare} disabled={!canPrepare || preparing}
                        className={cn('flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                          canPrepare && !preparing ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                        {preparing ? <><RefreshCw size={14} className="animate-spin" /> Preparando com IA...</> : 'Preparar Reativação'}
                      </button>
                    )}
                    {prepareError && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-500">{prepareError}</p>
                        </div>
                        <button onClick={() => { setPrepareError(null); setCreatedCampaignId(null) }}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted text-sm font-semibold text-foreground hover:bg-muted/70 transition-colors cursor-pointer">
                          Tentar novamente
                        </button>
                      </div>
                    )}
                    {previewMessages.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview das mensagens geradas</p>
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
                <button onClick={() => step > 1 ? setStep(s => s - 1) : setWizardOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                  {step === 1 ? 'Cancelar' : 'Voltar'}
                </button>
                {step < 3 ? (
                  <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canGoStep2 : !canGoStep3}
                    className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                      (step === 1 ? canGoStep2 : canGoStep3) ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                    Próximo <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={handleStart} disabled={previewMessages.length === 0 || starting}
                    className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                      previewMessages.length > 0 && !starting ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                    {starting ? <><RefreshCw size={14} className="animate-spin" /> Iniciando...</> : 'Confirmar e Iniciar'}
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

// ════════════════════════════════════════════════════════════════════════════
// TAB: CAMPANHAS
// ════════════════════════════════════════════════════════════════════════════

function TabCampanhas({ router }: { router: ReturnType<typeof useRouter> }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await disparoFetch('/api/campaigns')
      if (res.ok) setCampaigns(await res.json() as Campaign[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-500/8 border border-blue-500/15 rounded-xl flex-1 mr-4">
          <Info size={15} className="text-alliance-blue flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Campanhas de prospecção em massa gerenciadas pelo backend.
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer flex-shrink-0" title="Atualizar">
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Campanhas</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} encontrada{campaigns.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Send size={36} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Nome', 'Status', 'Total', 'Enviados', 'Falhas', 'Data'].map((h, i) => (
                  <th key={h} className={cn('px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider', i >= 2 && i <= 4 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map(c => (
                <tr key={c.id} onClick={() => router.push(`/disparos/${c.id}`)} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 font-medium text-foreground">{c.name}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5 text-right text-muted-foreground">{c.total_leads}</td>
                  <td className="px-5 py-3.5 text-right text-green-600">{c.sent_count}</td>
                  <td className="px-5 py-3.5 text-right text-red-500">{c.failed_count}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: INSTÂNCIAS
// ════════════════════════════════════════════════════════════════════════════

function TabInstancias() {
  const [instances, setInstances] = useState<WaInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [connectOpen, setConnectOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrData, setQrData] = useState<{ name: string; qr: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase.from('wa_instances').select('*').order('created_at', { ascending: false })
      setInstances((data ?? []) as WaInstance[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleConnect = async () => {
    if (!newName.trim() || !newToken.trim()) return
    setConnecting(true)
    try {
      await disparoFetch('/api/instances/connect', { method: 'POST', body: JSON.stringify({ name: newName.trim(), instanceToken: newToken.trim() }) })
      setConnectOpen(false); setNewName(''); setNewToken(''); await load()
    } catch { /* silent */ }
    setConnecting(false)
  }

  const handleDelete = async (token: string) => {
    try { await disparoFetch(`/api/instances/${token}`, { method: 'DELETE' }); setDeleteConfirm(null); await load() }
    catch { /* silent */ }
  }

  const handleCheckStatus = async (token: string) => {
    try { await disparoFetch(`/api/instances/${token}/status`); await load() }
    catch { /* silent */ }
  }

  const handleShowQr = async (inst: WaInstance) => {
    setQrLoading(true); setQrData(null); setQrOpen(true)
    try {
      const res = await disparoFetch(`/api/instances/${inst.instance_id}/qrcode`)
      if (res.ok) {
        const d = await res.json() as { qr?: string; qrcode?: string; base64?: string }
        setQrData({ name: inst.name, qr: d.qrcode ?? d.qr ?? d.base64 ?? '' })
      }
    } catch { /* silent */ }
    setQrLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setConnectOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer">
          <Plus size={15} /> Conectar Instância
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={22} className="animate-spin text-muted-foreground" /></div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Smartphone size={40} className="text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map(inst => (
            <div key={inst.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{inst.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[140px]">{inst.instance_id}</p>
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', INST_STATUS_STYLES[inst.status] ?? INST_STATUS_STYLES.disconnected)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', inst.status === 'connected' ? 'bg-green-500' : inst.status === 'connecting' ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
                  {INST_STATUS_LABELS[inst.status] ?? inst.status}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                {inst.phone && <div className="flex items-center justify-between"><span className="text-muted-foreground">Telefone</span><span className="font-mono text-foreground">{inst.phone}</span></div>}
                {inst.connected_at && <div className="flex items-center justify-between"><span className="text-muted-foreground">Conectado em</span><span className="text-foreground">{format(new Date(inst.connected_at), 'dd/MM HH:mm', { locale: ptBR })}</span></div>}
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Criado em</span><span className="text-foreground">{format(new Date(inst.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <button onClick={() => handleCheckStatus(inst.instance_id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                  <RefreshCw size={12} /> Verificar
                </button>
                {inst.status !== 'connected' && (
                  <button onClick={() => handleShowQr(inst)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-alliance-blue hover:bg-alliance-blue/10 transition-colors cursor-pointer">
                    <QrCode size={12} /> QR Code
                  </button>
                )}
                <button onClick={() => setDeleteConfirm(inst.instance_id)} className="flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer">
                  <Trash2 size={12} />
                </button>
              </div>
              <AnimatePresence>
                {deleteConfirm === inst.instance_id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex flex-col gap-2 pt-2 border-t border-border">
                      <p className="text-xs text-red-500 font-medium">Confirmar exclusão?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(inst.instance_id)} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors cursor-pointer">Excluir</button>
                        <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold cursor-pointer">Cancelar</button>
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
        {connectOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setConnectOpen(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold text-foreground">Conectar Instância</h2>
                <button onClick={() => setConnectOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"><X size={16} className="text-muted-foreground" /></button>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome da instância</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: WhatsApp Principal" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instance Token</label>
                  <input type="text" value={newToken} onChange={e => setNewToken(e.target.value)} placeholder="token-da-instancia" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                <button onClick={() => setConnectOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
                <button onClick={handleConnect} disabled={!newName.trim() || !newToken.trim() || connecting}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                    newName.trim() && newToken.trim() && !connecting ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                  {connecting ? <><RefreshCw size={14} className="animate-spin" /> Conectando...</> : 'Conectar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR modal */}
      <AnimatePresence>
        {qrOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setQrOpen(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div><h2 className="text-base font-bold text-foreground">QR Code</h2>{qrData && <p className="text-xs text-muted-foreground mt-0.5">{qrData.name}</p>}</div>
                <button onClick={() => setQrOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"><X size={16} className="text-muted-foreground" /></button>
              </div>
              <div className="p-6 flex flex-col items-center gap-4">
                {qrLoading ? (
                  <div className="w-56 h-56 flex items-center justify-center"><RefreshCw size={28} className="animate-spin text-muted-foreground" /></div>
                ) : qrData?.qr ? (
                  <>
                    <div className="bg-white p-3 rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`} alt="QR Code" width={220} height={220} className="block" />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Escaneie no WhatsApp para conectar</p>
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

// ════════════════════════════════════════════════════════════════════════════
// TAB: TEMPLATES
// ════════════════════════════════════════════════════════════════════════════

function TabTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false })
      setTemplates((data ?? []) as Template[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (t: Template) => { setEditing(t); setForm({ name: t.name, content: t.content, media_url: t.media_url ?? '', media_type: t.media_type ?? 'image' }); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const supabase = createSupabase()
      const payload = { name: form.name.trim(), content: form.content.trim(), media_url: form.media_url.trim() || null, media_type: form.media_url.trim() ? form.media_type : null }
      if (editing) { await supabase.from('templates').update(payload as never).eq('id', editing.id) }
      else { await supabase.from('templates').insert(payload as never) }
      setModalOpen(false); await load()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try { const supabase = createSupabase(); await supabase.from('templates').delete().eq('id', id); setDeleteConfirm(null); await load() }
    catch { /* silent */ }
    setDeleting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer">
          <Plus size={15} /> Novo Template
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Templates</h2>
          <span className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={36} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhum template criado ainda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mídia</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map(t => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{t.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground max-w-xs">{t.content.length > 80 ? `${t.content.slice(0, 80)}…` : t.content}</td>
                  <td className="px-5 py-3.5">
                    {t.media_type ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{MEDIA_TYPE_LABELS[t.media_type] ?? t.media_type}</span> : <span className="text-muted-foreground/40 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{format(new Date(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer" title="Editar"><Pencil size={13} className="text-muted-foreground" /></button>
                      <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title="Excluir"><Trash2 size={13} className="text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <h2 className="text-base font-bold text-foreground">{editing ? 'Editar Template' : 'Novo Template'}</h2>
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"><X size={16} className="text-muted-foreground" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do template" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo <span className="text-red-500">*</span></label>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Texto da mensagem..." rows={5} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">URL de Mídia (opcional)</label>
                  <input type="url" value={form.media_url} onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50" />
                </div>
                {form.media_url.trim() && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Mídia</label>
                    <select value={form.media_type} onChange={e => setForm(f => ({ ...f, media_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30">
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                      <option value="document">Documento</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
                <button onClick={handleSave} disabled={!form.name.trim() || !form.content.trim() || saving}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                    form.name.trim() && form.content.trim() && !saving ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                  {saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : (editing ? 'Salvar' : 'Criar')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-base font-bold text-foreground mb-2">Excluir template?</h2>
              <p className="text-sm text-muted-foreground mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
