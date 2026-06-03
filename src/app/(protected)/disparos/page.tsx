'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  RefreshCw, Plus, X, ChevronRight, AlertTriangle, Check,
  Send, Smartphone, FileText, QrCode, Trash2, Pencil, Sparkles, Users, Shuffle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Database, ReactivationCampaign, WaInstance, Campaign, Template } from '@/lib/supabase/types'
import { KANBAN_COLUMNS } from '@/components/kanban/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Lead = Database['public']['Tables']['leads']['Row']
type LeadRow = Pick<Lead, 'id' | 'name' | 'phone' | 'stage' | 'reactivation_count' | 'last_reactivated_at'>
type CampaignLeadRow = Pick<Lead, 'id' | 'name' | 'phone' | 'stage' | 'reactivation_count'>

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
  // ── Listing ────────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<ReactivationCampaign[]>([])
  const [loading, setLoading] = useState(true)

  // ── Wizard ─────────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(1)

  // Step 1: Kanban contact selection
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())

  // Step 2: Mode + messages
  const [mode, setMode] = useState<'template' | 'context' | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [mixedMessages, setMixedMessages] = useState<Record<string, string>>({})
  const [mixing, setMixing] = useState(false)
  const [mixError, setMixError] = useState<string | null>(null)
  const [generatedMessages, setGeneratedMessages] = useState<Record<string, string>>({})
  const [generatingContext, setGeneratingContext] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)

  // Step 3: Config
  const [intervalOption, setIntervalOption] = useState(1)
  const [instances, setInstances] = useState<WaInstance[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')

  // Save
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────
  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadRow[]> = {}
    for (const l of leads) {
      if (!map[l.stage]) map[l.stage] = []
      map[l.stage]!.push(l)
    }
    return map
  }, [leads])

  const selectedLeadObjects = useMemo(
    () => leads.filter(l => selectedLeadIds.has(l.id)),
    [leads, selectedLeadIds],
  )

  const messagesReady = useMemo(() => {
    if (!mode || selectedLeadObjects.length === 0) return false
    const map = mode === 'template' ? mixedMessages : generatedMessages
    return selectedLeadObjects.every(l => !!map[l.id])
  }, [mode, selectedLeadObjects, mixedMessages, generatedMessages])

  const canGoStep2 = selectedLeadIds.size > 0
  const canGoStep3 = messagesReady
  const canCreate  = !!selectedInstance

  // ── Load listing ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('reactivation_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      setCampaigns((data ?? []) as ReactivationCampaign[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Open wizard ────────────────────────────────────────────────────────────
  const openWizard = async () => {
    setStep(1)
    setSelectedLeadIds(new Set())
    setMode(null)
    setSelectedTemplate(null)
    setMixedMessages({})
    setMixError(null)
    setGeneratedMessages({})
    setContextError(null)
    setCreateError(null)
    setIntervalOption(1)
    setWizardOpen(true)
    setLeadsLoading(true)
    const supabase = createSupabase()
    const [{ data: leadsData }, { data: tmplData }, { data: instData }] = await Promise.all([
      supabase.from('leads').select('id, name, phone, stage, reactivation_count, last_reactivated_at').order('name'),
      supabase.from('templates').select('*').order('created_at', { ascending: false }),
      supabase.from('wa_instances').select('*').eq('status', 'connected'),
    ])
    setLeads((leadsData ?? []) as LeadRow[])
    setTemplates((tmplData ?? []) as Template[])
    const insts = (instData ?? []) as WaInstance[]
    setInstances(insts)
    if (insts.length) setSelectedInstance(insts[0].instance_id)
    setLeadsLoading(false)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleStage = useCallback((stageId: string) => {
    const stageLeads = leadsByStage[stageId] ?? []
    setSelectedLeadIds(prev => {
      const n = new Set(prev)
      const allSelected = stageLeads.every(l => n.has(l.id))
      if (allSelected) stageLeads.forEach(l => n.delete(l.id))
      else stageLeads.forEach(l => n.add(l.id))
      return n
    })
  }, [leadsByStage])

  const toggleLead = useCallback((id: string) => {
    setSelectedLeadIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }, [])

  const handleMixTemplate = async () => {
    if (!selectedTemplate) return
    setMixing(true); setMixError(null)
    try {
      const res = await fetch('/api/campaigns/mix-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selectedTemplate.content, count: selectedLeadObjects.length }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setMixError(err.error ?? 'Erro ao misturar mensagem')
      } else {
        const data = await res.json() as { messages: string[] }
        const map: Record<string, string> = {}
        selectedLeadObjects.forEach((l, i) => { map[l.id] = data.messages[i] ?? selectedTemplate.content })
        setMixedMessages(map)
      }
    } catch { setMixError('Erro de conexão') }
    setMixing(false)
  }

  const handleGenerateContext = async () => {
    setGeneratingContext(true); setContextError(null)
    try {
      const res = await fetch('/api/leads/reactivation-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: Array.from(selectedLeadIds) }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setContextError(err.error ?? 'Erro ao gerar mensagens')
      } else {
        const data = await res.json() as { results: { lead_id: string; message: string }[] }
        const map: Record<string, string> = {}
        for (const r of data.results) { if (r.message) map[r.lead_id] = r.message }
        setGeneratedMessages(map)
      }
    } catch { setContextError('Erro de conexão') }
    setGeneratingContext(false)
  }

  const handleCreate = async () => {
    if (!selectedInstance) return
    setCreating(true); setCreateError(null)
    const opt = INTERVAL_OPTIONS[intervalOption]
    const msgMap = mode === 'template' ? mixedMessages : generatedMessages
    const msgEntries = selectedLeadObjects
      .map(l => ({ lead_id: l.id, phone: l.phone, message: msgMap[l.id] ?? '' }))
      .filter(e => !!e.message)
    const refMsgs = msgEntries.map(e => e.message).slice(0, 5)
    const base = refMsgs[0] ?? 'mensagem personalizada'
    while (refMsgs.length < 5) refMsgs.push(base)
    try {
      const createRes = await fetch('/api/reactivation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Reativação ${format(new Date(), 'dd/MM HH:mm', { locale: ptBR })}`,
          instance_id: selectedInstance,
          reference_messages: refMsgs,
          interval_min: opt.min,
          interval_max: opt.max,
          contacts: selectedLeadObjects.map(l => ({ id: l.id, phone: l.phone })),
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json() as { error?: string }
        setCreateError(err.error ?? 'Erro ao criar campanha')
        setCreating(false); return
      }
      const { id: campaignId } = await createRes.json() as { id: string }
      const injectRes = await fetch(`/api/reactivation/${campaignId}/inject-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgEntries }),
      })
      if (!injectRes.ok) {
        const err = await injectRes.json() as { error?: string }
        setCreateError(err.error ?? 'Erro ao configurar mensagens')
        setCreating(false); return
      }
      setWizardOpen(false)
      loadAll()
      router.push(`/disparos/reativar/${campaignId}`)
    } catch { setCreateError('Erro de conexão') }
    setCreating(false)
  }

  const STEP_LABELS = ['Contatos', 'Mensagem', 'Configuração']

  return (
    <div className="flex flex-col gap-6">
      {/* Header + action */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={loadAll} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={openWizard} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer">
          <Plus size={15} /> Nova Reativação
        </button>
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
                {['Nome', 'Status', 'Contatos', 'Enviados', 'Falhas', 'Data'].map((h, i) => (
                  <th key={h} className={cn('px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider', i >= 2 && i <= 4 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map(c => (
                <tr key={c.id} onClick={() => router.push(`/disparos/reativar/${c.id}`)} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 leading-none flex-shrink-0">Reativação</span>
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
              className={cn(
                'bg-card border border-border rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200',
                step === 1 ? 'max-w-5xl' : 'max-w-2xl',
              )}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-foreground">Nova Reativação</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Passo {step} de 3 — {STEP_LABELS[step - 1]}
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

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* ── Step 1: Kanban ─────────────────────────────────────────── */}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">Recomendamos no máximo 10 contatos a cada 4 horas para evitar bloqueios.</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Clique em um estágio para selecionar todos, ou escolha leads individualmente</p>
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full transition-colors',
                        selectedLeadIds.size > 0 ? 'bg-alliance-blue/15 text-alliance-blue' : 'bg-muted text-muted-foreground')}>
                        {selectedLeadIds.size} selecionado{selectedLeadIds.size !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {selectedLeadIds.size > 10 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle size={13} className="text-red-500" />
                        <p className="text-xs text-red-500">Mais de 10 contatos. Risco elevado de bloqueio.</p>
                      </div>
                    )}
                    {leadsLoading ? (
                      <div className="flex items-center justify-center py-12"><RefreshCw size={18} className="animate-spin text-muted-foreground" /></div>
                    ) : leads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Users size={28} className="text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">Nenhum lead no CRM</p>
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {KANBAN_COLUMNS.map(col => {
                          const stageLeads = leadsByStage[col.id] ?? []
                          if (stageLeads.length === 0) return null
                          const selectedInStage = stageLeads.filter(l => selectedLeadIds.has(l.id)).length
                          const allSelected = selectedInStage === stageLeads.length
                          const someSelected = selectedInStage > 0 && !allSelected
                          const Icon = col.icon
                          return (
                            <div key={col.id} className="flex flex-col flex-shrink-0 w-44 gap-2">
                              <button
                                onClick={() => toggleStage(col.id)}
                                className={cn('flex flex-col gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-left w-full',
                                  allSelected ? 'border-alliance-blue bg-alliance-blue/10'
                                    : someSelected ? 'border-dashed bg-card'
                                    : 'border-border bg-card hover:bg-muted')}
                                style={someSelected ? { borderColor: `${col.color}60` } : undefined}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Icon size={12} style={{ color: col.color }} className="flex-shrink-0" />
                                    <span className="text-xs font-semibold truncate" style={{ color: col.color }}>{col.label}</span>
                                  </div>
                                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                    allSelected ? 'bg-alliance-blue text-white' : someSelected ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground')}>
                                    {selectedInStage}/{stageLeads.length}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {allSelected ? '✓ Todos selecionados' : someSelected ? `${selectedInStage} selecionado${selectedInStage !== 1 ? 's' : ''}` : 'Selecionar todos'}
                                </p>
                              </button>
                              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                                {stageLeads.map(lead => {
                                  const sel = selectedLeadIds.has(lead.id)
                                  return (
                                    <button key={lead.id} onClick={() => toggleLead(lead.id)}
                                      className={cn('flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors cursor-pointer w-full text-left',
                                        sel ? 'border-alliance-blue/40 bg-alliance-blue/10' : 'border-border bg-card hover:bg-muted')}>
                                      <div className={cn('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors',
                                        sel ? 'bg-alliance-blue border-alliance-blue' : 'border-muted-foreground/30')}>
                                        {sel && <Check size={8} className="text-white" />}
                                      </div>
                                      <p className="text-xs text-foreground truncate flex-1">{lead.name}</p>
                                      <span className="inline-flex items-center gap-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-[9px] font-bold px-1 py-0.5 rounded-full flex-shrink-0">
                                        {lead.reactivation_count ?? 0}×
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 2: Mode + messages ───────────────────────────────── */}
                {step === 2 && (
                  <div className="flex flex-col gap-5">
                    {/* Mode selector */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => { setMode('template'); setGeneratedMessages({}) }}
                        className={cn('flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-colors cursor-pointer',
                          mode === 'template' ? 'border-alliance-blue bg-alliance-blue/5' : 'border-border bg-card hover:bg-muted')}>
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', mode === 'template' ? 'bg-alliance-blue/10' : 'bg-muted')}>
                          <Shuffle size={18} className={mode === 'template' ? 'text-alliance-blue' : 'text-muted-foreground'} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">Usar Template</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Selecione um template e misture a mensagem para cada lead</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setMode('context'); setMixedMessages({}); setSelectedTemplate(null) }}
                        className={cn('flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-colors cursor-pointer',
                          mode === 'context' ? 'border-alliance-blue bg-alliance-blue/5' : 'border-border bg-card hover:bg-muted')}>
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', mode === 'context' ? 'bg-alliance-blue/10' : 'bg-muted')}>
                          <Sparkles size={18} className={mode === 'context' ? 'text-alliance-blue' : 'text-muted-foreground'} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">Criar com Contexto</p>
                          <p className="text-xs text-muted-foreground mt-0.5">IA analisa o histórico e cria mensagem personalizada para cada lead</p>
                        </div>
                      </button>
                    </div>

                    {/* Template mode */}
                    {mode === 'template' && (
                      <div className="flex flex-col gap-4">
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Selecionar template</h3>
                          </div>
                          {templates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                              <FileText size={24} className="text-muted-foreground/20" />
                              <p className="text-sm text-muted-foreground">Nenhum template. Crie um na aba Templates.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col divide-y divide-border max-h-[220px] overflow-y-auto">
                              {templates.map(t => (
                                <button key={t.id} onClick={() => { setSelectedTemplate(t); setMixedMessages({}) }}
                                  className={cn('flex items-start gap-3 px-5 py-3.5 text-left transition-colors cursor-pointer w-full',
                                    selectedTemplate?.id === t.id ? 'bg-alliance-blue/5' : 'hover:bg-muted/50')}>
                                  <div className={cn('w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                                    selectedTemplate?.id === t.id ? 'bg-alliance-blue border-alliance-blue' : 'border-border')}>
                                    {selectedTemplate?.id === t.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.content}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedTemplate && (
                          <div className="flex flex-col gap-3">
                            <button onClick={handleMixTemplate} disabled={mixing}
                              className={cn('flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                                !mixing ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                              {mixing ? <><RefreshCw size={14} className="animate-spin" /> Misturando...</> : <><Shuffle size={14} /> Misturar para {selectedLeadObjects.length} lead{selectedLeadObjects.length !== 1 ? 's' : ''}</>}
                            </button>
                            {mixError && (
                              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                <p className="text-xs text-red-500">{mixError}</p>
                              </div>
                            )}
                            {Object.keys(mixedMessages).length > 0 && (
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                                <Check size={13} className="text-green-600" />
                                <p className="text-xs font-semibold text-green-600">{Object.keys(mixedMessages).length} variações geradas</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Context mode */}
                    {mode === 'context' && (
                      <div className="flex flex-col gap-4">
                        <button onClick={handleGenerateContext} disabled={generatingContext}
                          className={cn('flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                            !generatingContext ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                          {generatingContext ? <><RefreshCw size={14} className="animate-spin" /> Gerando com IA...</> : <><Sparkles size={14} /> Gerar mensagens para {selectedLeadObjects.length} lead{selectedLeadObjects.length !== 1 ? 's' : ''}</>}
                        </button>
                        {contextError && (
                          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-500">{contextError}</p>
                          </div>
                        )}
                        {Object.keys(generatedMessages).length > 0 && (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                              <Check size={13} className="text-green-600" />
                              <p className="text-xs font-semibold text-green-600">{Object.keys(generatedMessages).length} de {selectedLeadObjects.length} mensagens geradas</p>
                            </div>
                            {selectedLeadObjects.filter(l => generatedMessages[l.id]).slice(0, 3).map(lead => (
                              <div key={lead.id} className="px-4 py-3 bg-muted/50 rounded-xl border border-border">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">{lead.name}</p>
                                <p className="text-sm text-foreground">{generatedMessages[lead.id]}</p>
                              </div>
                            ))}
                            {selectedLeadObjects.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">+ {selectedLeadObjects.length - 3} mais</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 3: Config ─────────────────────────────────────────── */}
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
                        <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-500">Nenhuma instância conectada. Vá à aba Instâncias.</p>
                        </div>
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
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                {createError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-500">{createError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button onClick={() => step > 1 ? setStep(s => s - 1) : setWizardOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                    {step === 1 ? 'Cancelar' : 'Voltar'}
                  </button>
                  {step < 3 ? (
                    <button onClick={() => setStep(s => s + 1)}
                      disabled={step === 1 ? !canGoStep2 : !canGoStep3}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                        (step === 1 ? canGoStep2 : canGoStep3) ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                      Próximo <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button onClick={handleCreate} disabled={!canCreate || creating}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                        canCreate && !creating ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                      {creating ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : <><Send size={14} /> Salvar campanha</>}
                    </button>
                  )}
                </div>
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
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(1)

  // Kanban lead selection
  const [leads, setLeads] = useState<CampaignLeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())

  // Wizard state
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [campaignName, setCampaignName] = useState('')
  const [intervalOption, setIntervalOption] = useState(1)
  const [instances, setInstances] = useState<WaInstance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const leadsByStage = useMemo(() => {
    const map: Record<string, CampaignLeadRow[]> = {}
    for (const lead of leads) {
      if (!map[lead.stage]) map[lead.stage] = []
      map[lead.stage]!.push(lead)
    }
    return map
  }, [leads])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      setCampaigns((data ?? []) as Campaign[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleStage = useCallback((stageId: string) => {
    const stageLeads = leadsByStage[stageId] ?? []
    setSelectedLeadIds(prev => {
      const n = new Set(prev)
      const allSelected = stageLeads.every(l => n.has(l.id))
      if (allSelected) stageLeads.forEach(l => n.delete(l.id))
      else stageLeads.forEach(l => n.add(l.id))
      return n
    })
  }, [leadsByStage])

  const toggleLead = useCallback((id: string) => {
    setSelectedLeadIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const openWizard = async () => {
    setStep(1)
    setSelectedLeadIds(new Set())
    setSelectedTemplateIds(new Set())
    setCampaignName('')
    setIntervalOption(1)
    setSelectedInstance('')
    setCreateError(null)
    setWizardOpen(true)
    setLeadsLoading(true)
    setTemplatesLoading(true)
    const supabase = createSupabase()
    const [{ data: leadsData }, { data: tmplData }, { data: instData }] = await Promise.all([
      supabase.from('leads').select('id, name, phone, stage, reactivation_count').order('name'),
      supabase.from('templates').select('*').order('created_at', { ascending: false }),
      supabase.from('wa_instances').select('*').eq('status', 'connected'),
    ])
    setLeads((leadsData ?? []) as CampaignLeadRow[])
    setLeadsLoading(false)
    setTemplates((tmplData ?? []) as Template[])
    const insts = (instData ?? []) as WaInstance[]
    setInstances(insts)
    if (insts.length) setSelectedInstance(insts[0].instance_id)
    setTemplatesLoading(false)
  }

  const toggleTemplate = (id: string) => setSelectedTemplateIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const handleCreate = async () => {
    if (!campaignName.trim() || !selectedInstance) return
    setCreating(true)
    setCreateError(null)
    try {
      const opt = INTERVAL_OPTIONS[intervalOption]
      const phones = leads
        .filter(l => selectedLeadIds.has(l.id))
        .map(l => l.phone.replace('@s.whatsapp.net', '').replace(/\D/g, ''))
        .filter(p => p.length >= 10)

      if (phones.length === 0) {
        setCreateError('Nenhum lead com telefone válido selecionado')
        setCreating(false)
        return
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          template_ids: Array.from(selectedTemplateIds),
          instance_id: selectedInstance,
          interval_min: opt.min,
          interval_max: opt.max,
          phones,
        }),
      })
      if (res.ok) {
        const created = await res.json() as { id: string }
        setWizardOpen(false)
        load()
        router.push(`/disparos/${created.id}`)
      } else {
        const err = await res.json() as { error?: string }
        setCreateError(err.error ?? 'Erro ao criar campanha')
      }
    } catch {
      setCreateError('Erro de conexão ao criar campanha')
    }
    setCreating(false)
  }

  const canGoStep2 = selectedLeadIds.size > 0
  const canGoStep3 = selectedTemplateIds.size > 0
  const canCreate  = campaignName.trim().length > 0 && !!selectedInstance

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" title="Atualizar">
          <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={openWizard} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer">
          <Plus size={15} /> Nova Campanha
        </button>
      </div>

      {/* Campaigns table */}
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
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 leading-none flex-shrink-0">
                        Disparo
                      </span>
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setWizardOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
              className={cn(
                'bg-card border border-border rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200',
                step === 1 ? 'max-w-5xl' : 'max-w-2xl',
              )}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-foreground">Nova Campanha</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Passo {step} de 3 — {step === 1 ? 'Selecionar leads do Kanban' : step === 2 ? 'Templates' : 'Configuração'}
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

                {/* Step 1 — Kanban visual selector */}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">Recomendamos no máximo 50 contatos por campanha para evitar bloqueios.</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Clique em um estágio para selecionar todos, ou escolha leads individualmente
                      </p>
                      <span className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full transition-colors',
                        selectedLeadIds.size > 0 ? 'bg-alliance-blue/15 text-alliance-blue' : 'bg-muted text-muted-foreground',
                      )}>
                        {selectedLeadIds.size} selecionado{selectedLeadIds.size !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {leadsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Users size={28} className="text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">Nenhum lead no CRM</p>
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {KANBAN_COLUMNS.map(col => {
                          const stageLeads = leadsByStage[col.id] ?? []
                          if (stageLeads.length === 0) return null
                          const selectedInStage = stageLeads.filter(l => selectedLeadIds.has(l.id)).length
                          const allSelected = selectedInStage === stageLeads.length
                          const someSelected = selectedInStage > 0 && !allSelected
                          const Icon = col.icon
                          return (
                            <div key={col.id} className="flex flex-col flex-shrink-0 w-44 gap-2">
                              {/* Stage header — click to toggle all in stage */}
                              <button
                                onClick={() => toggleStage(col.id)}
                                className={cn(
                                  'flex flex-col gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-left w-full',
                                  allSelected
                                    ? 'border-alliance-blue bg-alliance-blue/10'
                                    : someSelected
                                    ? 'border-dashed bg-card'
                                    : 'border-border bg-card hover:bg-muted',
                                )}
                                style={someSelected ? { borderColor: `${col.color}60` } : undefined}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Icon size={12} style={{ color: col.color }} className="flex-shrink-0" />
                                    <span className="text-xs font-semibold truncate" style={{ color: col.color }}>{col.label}</span>
                                  </div>
                                  <span className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                    allSelected
                                      ? 'bg-alliance-blue text-white'
                                      : someSelected
                                      ? 'bg-muted text-foreground'
                                      : 'bg-muted text-muted-foreground',
                                  )}>
                                    {selectedInStage}/{stageLeads.length}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {allSelected
                                    ? '✓ Todos selecionados'
                                    : someSelected
                                    ? `${selectedInStage} selecionado${selectedInStage !== 1 ? 's' : ''}`
                                    : 'Selecionar todos'}
                                </p>
                              </button>

                              {/* Individual lead cards */}
                              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                                {stageLeads.map(lead => {
                                  const sel = selectedLeadIds.has(lead.id)
                                  return (
                                    <button
                                      key={lead.id}
                                      onClick={() => toggleLead(lead.id)}
                                      className={cn(
                                        'flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors cursor-pointer w-full text-left',
                                        sel ? 'border-alliance-blue/40 bg-alliance-blue/10' : 'border-border bg-card hover:bg-muted',
                                      )}
                                    >
                                      <div className={cn(
                                        'w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors',
                                        sel ? 'bg-alliance-blue border-alliance-blue' : 'border-muted-foreground/30',
                                      )}>
                                        {sel && <Check size={8} className="text-white" />}
                                      </div>
                                      <p className="text-xs text-foreground truncate flex-1">{lead.name}</p>
                                      <span className="inline-flex items-center gap-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-[9px] font-bold px-1 py-0.5 rounded-full flex-shrink-0">
                                        {lead.reactivation_count ?? 0}×
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {selectedLeadIds.size > 50 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle size={13} className="text-red-500" />
                        <p className="text-xs text-red-500">Mais de 50 contatos selecionados. Risco elevado de bloqueio.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 — Templates */}
                {step === 2 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">Selecione um ou mais templates para esta campanha.</p>
                    {templatesLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <FileText size={28} className="text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">Nenhum template disponível. Crie um na aba Templates.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => toggleTemplate(t.id)}
                            className={cn(
                              'flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer w-full',
                              selectedTemplateIds.has(t.id)
                                ? 'border-alliance-blue bg-alliance-blue/10'
                                : 'border-border bg-card hover:bg-muted',
                            )}
                          >
                            <div className={cn(
                              'w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                              selectedTemplateIds.has(t.id) ? 'bg-alliance-blue border-alliance-blue' : 'border-border',
                            )}>
                              {selectedTemplateIds.has(t.id) && <Check size={10} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {t.content.length > 60 ? `${t.content.slice(0, 60)}…` : t.content}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedTemplateIds.size > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedTemplateIds.size} template{selectedTemplateIds.size !== 1 ? 's' : ''} selecionado{selectedTemplateIds.size !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}

                {/* Step 3 — Configuração */}
                {step === 3 && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Nome da campanha <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={e => setCampaignName(e.target.value)}
                        placeholder="Ex: Prospecção Maio 2026"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intervalo entre mensagens</label>
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
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instância WhatsApp</label>
                      {instances.length === 0 ? (
                        <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-500">Nenhuma instância conectada. Vá à aba Instâncias.</p>
                        </div>
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
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                {createError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-500">{createError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
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
                    onClick={handleCreate}
                    disabled={!canCreate || creating}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                      canCreate && !creating
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-muted text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    {creating ? <><RefreshCw size={14} className="animate-spin" /> Criando...</> : 'Criar Campanha'}
                  </button>
                )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
