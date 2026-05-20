'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, ArrowRight, Check, RefreshCw, Plus, X, Sparkles,
  FileText, Users, Clock, Shuffle, Phone, AlertTriangle,
  MessageSquare, Send, Timer, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { disparoFetch } from '@/lib/disparo-api'
import type { Database, Template, WaInstance } from '@/lib/supabase/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type LeadRow = Pick<
  Database['public']['Tables']['leads']['Row'],
  'id' | 'name' | 'phone' | 'reactivation_count' | 'last_reactivated_at'
>

interface ContactItem {
  id: string | null   // null = manual phone
  name: string
  phone: string       // always with @s.whatsapp.net
}

interface ScheduledContact extends ContactItem {
  message: string
  intervalMin: number
  intervalSec: number
  intervalMs: number
  intervalTotalMs: number
  delayMs: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { label: '1 a 3 min', min: 1, max: 3 },
  { label: '2 a 4 min', min: 2, max: 4 },
  { label: '3 a 6 min', min: 3, max: 6 },
  { label: '5 a 10 min', min: 5, max: 10 },
]

const STEPS = ['Contatos', 'Mensagem', 'Configuração', 'Resumo']

// ── Helpers ───────────────────────────────────────────────────────────────────

function createSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function toWaId(digits: string): string {
  return `${digits}@s.whatsapp.net`
}

function generateContactSchedule(
  contacts: ContactItem[],
  messages: Record<string, string>,
  optionIndex: number,
): ScheduledContact[] {
  const opt = INTERVAL_OPTIONS[optionIndex]!
  return contacts.map((c) => {
    // Random minutes within range, then random sec + ms
    const totalMinFrac = opt.min + Math.random() * (opt.max - opt.min)
    const totalMs = Math.round(totalMinFrac * 60 * 1000)
    const min = Math.floor(totalMs / 60000)
    const sec = Math.floor((totalMs % 60000) / 1000)
    const ms  = totalMs % 1000
    const delayMs = Math.floor(2000 + Math.random() * 3000)
    const key = c.id ?? c.phone
    return {
      ...c,
      message:        messages[key] ?? '',
      intervalMin:    min,
      intervalSec:    sec,
      intervalMs:     ms,
      intervalTotalMs: totalMs,
      delayMs,
    }
  })
}

function formatIntervalDisplay(min: number, sec: number, ms: number) {
  return `${String(min).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s ${String(ms).padStart(3, '0').slice(0, 2)}ms`
}

function formatEstimated(totalMs: number) {
  const minutes = Math.floor(totalMs / 60000)
  const hours   = Math.floor(minutes / 60)
  const mins    = minutes % 60
  if (hours > 0) return `~${hours}h ${mins}min`
  return `~${minutes} min`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NovoDisparoPage() {
  const router = useRouter()

  // navigation
  const [step, setStep] = useState(1)

  // step 1 — contacts
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [manualInput, setManualInput] = useState('')
  const [manualPhones, setManualPhones] = useState<string[]>([]) // as @s.whatsapp.net
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // step 2 — messages
  const [messageMode, setMessageMode] = useState<'template' | 'context' | null>(null)
  const [templates, setTemplates]     = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [mixedMessages, setMixedMessages]       = useState<Record<string, string>>({})
  const [mixing, setMixing]                     = useState(false)
  const [mixError, setMixError]                 = useState<string | null>(null)
  const [contextMessages, setContextMessages]   = useState<Record<string, string>>({})
  const [manualContexts, setManualContexts]     = useState<Record<string, string>>({}) // lead_id → texto livre
  const [generatingContextId, setGeneratingContextId] = useState<string | null>(null) // 'all' | lead_id | null
  const [contextError, setContextError]          = useState<string | null>(null)

  // step 3 — config
  const [campaignName, setCampaignName] = useState('')
  const [intervalOption, setIntervalOption] = useState(0)
  const [instances, setInstances]   = useState<WaInstance[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')

  // step 4 — schedule
  const [schedule, setSchedule] = useState<ScheduledContact[]>([])

  // save
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedLeads = useMemo(
    () => leads.filter(l => selectedLeadIds.has(l.id)),
    [leads, selectedLeadIds],
  )

  const allContacts = useMemo<ContactItem[]>(() => {
    const fromLeads: ContactItem[] = selectedLeads.map(l => ({
      id:    l.id,
      name:  l.name,
      phone: l.phone.includes('@') ? l.phone : toWaId(normalizePhone(l.phone)),
    }))
    const fromManual: ContactItem[] = manualPhones.map(p => ({
      id:    null,
      name:  p.replace('@s.whatsapp.net', ''),
      phone: p,
    }))
    return [...fromLeads, ...fromManual]
  }, [selectedLeads, manualPhones])

  const combinedMessages = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(contextMessages)) map[k] = v
    for (const [k, v] of Object.entries(mixedMessages)) map[k] = v
    return map
  }, [contextMessages, mixedMessages])

  const estimatedMs = useMemo(
    () => schedule.reduce((acc, s) => acc + s.intervalTotalMs, 0),
    [schedule],
  )

  const generatingContext = generatingContextId !== null

  const messagesReady = useMemo(() => {
    if (!messageMode) return false
    return allContacts.every(c => {
      const key = c.id ?? c.phone
      return !!combinedMessages[key]
    })
  }, [messageMode, allContacts, combinedMessages])

  const canGoStep2 = allContacts.length > 0
  const canGoStep3 = messagesReady
  const canGoStep4 = campaignName.trim().length > 0 && !!selectedInstance
  const canSave    = schedule.length > 0 && schedule.every(s => !!s.message)

  // ── Load on mount ────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createSupabase()
    Promise.all([
      supabase.from('leads').select('id, name, phone, reactivation_count, last_reactivated_at').order('name'),
      supabase.from('wa_instances').select('*').eq('status', 'connected'),
    ]).then(([{ data: leadsData }, { data: instData }]) => {
      setLeads((leadsData ?? []) as LeadRow[])
      const insts = (instData ?? []) as WaInstance[]
      setInstances(insts)
      if (insts.length) setSelectedInstance(insts[0].instance_id)
    }).finally(() => setLeadsLoading(false))

    setCampaignName(`Disparo ${format(new Date(), "dd/MM 'às' HH:mm", { locale: ptBR })}`)
  }, [])

  // Load templates when entering step 2
  useEffect(() => {
    if (step !== 2) return
    setTemplatesLoading(true)
    createSupabase()
      .from('templates').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data ?? []) as Template[])
        setTemplatesLoading(false)
      })
  }, [step])

  // Generate schedule when entering step 4
  useEffect(() => {
    if (step !== 4) return
    setSchedule(generateContactSchedule(allContacts, combinedMessages, intervalOption))
  }, [step, allContacts, combinedMessages, intervalOption])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleLead = useCallback((id: string) => {
    setSelectedLeadIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedLeadIds(prev =>
      prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id))
    )
  }, [leads])

  const addManualPhone = useCallback(() => {
    setPhoneError(null)
    const digits = normalizePhone(manualInput)
    if (digits.length < 10 || digits.length > 15) {
      setPhoneError('Número inválido. Use o formato 5511999999999')
      return
    }
    const waId = toWaId(digits)
    if (manualPhones.includes(waId)) {
      setPhoneError('Número já adicionado')
      return
    }
    setManualPhones(prev => [...prev, waId])
    setManualInput('')
  }, [manualInput, manualPhones])

  const removeManualPhone = useCallback((phone: string) => {
    setManualPhones(prev => prev.filter(p => p !== phone))
    setMixedMessages(prev => { const n = { ...prev }; delete n[phone]; return n })
  }, [])

  const handleMixTemplate = useCallback(async () => {
    if (!selectedTemplate) return
    setMixing(true)
    setMixError(null)
    try {
      const res = await fetch('/api/campaigns/mix-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selectedTemplate.content, count: allContacts.length }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setMixError(err.error ?? 'Erro ao misturar mensagem')
        return
      }
      const data = await res.json() as { messages: string[] }
      const map: Record<string, string> = {}
      allContacts.forEach((c, i) => {
        const key = c.id ?? c.phone
        map[key] = data.messages[i] ?? selectedTemplate.content
      })
      setMixedMessages(map)
    } catch {
      setMixError('Erro de conexão')
    }
    setMixing(false)
  }, [selectedTemplate, allContacts])

  // Gera para um lead específico OU para todos (leadId = 'all')
  const handleGenerateContext = useCallback(async (leadId: 'all' | string) => {
    const leadContacts = allContacts.filter(c => c.id !== null)
    if (leadContacts.length === 0) return

    const targets = leadId === 'all'
      ? leadContacts
      : leadContacts.filter(c => c.id === leadId)

    if (targets.length === 0) return
    setGeneratingContextId(leadId)
    setContextError(null)
    try {
      const res = await fetch('/api/leads/reactivation-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: targets.map(c => c.id),
          manual_contexts: manualContexts,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setContextError(err.error ?? 'Erro ao gerar mensagens')
        return
      }
      const data = await res.json() as { results: { lead_id: string; message: string }[] }
      setContextMessages(prev => {
        const updated = { ...prev }
        for (const r of data.results) {
          if (r.message) updated[r.lead_id] = r.message
        }
        return updated
      })
    } catch {
      setContextError('Erro de conexão')
    }
    setGeneratingContextId(null)
  }, [allContacts, manualContexts])

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedInstance) return
    setSaving(true)
    setSaveError(null)
    try {
      // 1. Create reactivation campaign via external disparo API
      const createRes = await disparoFetch('/api/reactivation', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName.trim(),
          instance_id: selectedInstance,
          reference_messages: [schedule[0]?.message ?? ''],
          interval_min: INTERVAL_OPTIONS[intervalOption]!.min,
          interval_max: INTERVAL_OPTIONS[intervalOption]!.max,
          contacts: allContacts.map(c => ({
            id:    c.id,
            phone: c.phone,
          })),
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json() as { error?: string }
        setSaveError(err.error ?? 'Erro ao criar campanha')
        setSaving(false)
        return
      }

      const created = await createRes.json() as { id: string }
      const campaignId = created.id

      // 2. Inject per-contact messages + pre-computed timing
      const injectPayload = schedule.map(s => ({
        lead_id:           s.id,
        phone:             s.phone,
        message:           s.message,
        interval_delay_ms: s.intervalTotalMs,
        typing_delay:      s.delayMs,
      }))

      const injectRes = await fetch(`/api/reactivation/${campaignId}/inject-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: injectPayload }),
      })

      if (!injectRes.ok) {
        const err = await injectRes.json() as { error?: string }
        setSaveError(err.error ?? 'Erro ao configurar mensagens')
        setSaving(false)
        return
      }

      // 3. Navigate to campaign detail
      router.push(`/disparos/reativar/${campaignId}`)
    } catch {
      setSaveError('Erro de conexão')
    }
    setSaving(false)
  }, [canSave, selectedInstance, campaignName, schedule, intervalOption, allContacts, router])

  // ── Step navigation ──────────────────────────────────────────────────────────

  const goNext = () => setStep(s => s + 1)
  const goPrev = () => setStep(s => s - 1)

  const canGoNext = [canGoStep2, canGoStep3, canGoStep4, canSave][step - 1] ?? false

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-lg">

      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/disparos')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-3"
        >
          <ArrowLeft size={14} /> Disparos
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">Novo Disparo</p>
            <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Configurar Campanha</h1>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => {
              const s = i + 1
              const done    = step > s
              const current = step === s
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      current ? 'bg-alliance-blue text-white' : done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
                    )}>
                      {done ? <Check size={12} /> : s}
                    </div>
                    <span className={cn(
                      'text-xs font-medium hidden md:inline',
                      current ? 'text-alliance-blue' : done ? 'text-green-600' : 'text-muted-foreground',
                    )}>{label}</span>
                  </div>
                  {s < STEPS.length && <div className="w-6 h-px bg-border" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">

        {/* ── STEP 1: Contatos ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">Recomendamos no máximo 10 contatos a cada 4 horas para evitar bloqueios.</p>
            </div>

            {/* Manual phone input */}
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Phone size={15} className="text-alliance-blue" />
                <h3 className="text-sm font-semibold text-foreground">Adicionar número manual</h3>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={e => { setManualInput(e.target.value); setPhoneError(null) }}
                    onKeyDown={e => e.key === 'Enter' && addManualPhone()}
                    placeholder="5511999999999"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/40"
                  />
                  {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                </div>
                <button
                  onClick={addManualPhone}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer flex-shrink-0"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Digite no formato <span className="font-mono font-medium">5511999999999</span> (DDI+DDD+número)</p>

              {manualPhones.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
                  {manualPhones.map(p => (
                    <div key={p} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
                      <span className="text-xs font-mono text-foreground">{p.replace('@s.whatsapp.net', '')}</span>
                      <button onClick={() => removeManualPhone(p)} className="p-1 rounded hover:bg-muted transition-colors cursor-pointer">
                        <X size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leads from DB */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Leads do CRM</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedLeadIds.size} selecionado{selectedLeadIds.size !== 1 ? 's' : ''}
                  {manualPhones.length > 0 && ` · ${manualPhones.length} manual`}
                </span>
              </div>

              {leadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={leads.length > 0 && selectedLeadIds.size === leads.length}
                            onChange={toggleAll}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Nome</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Telefone</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Reativações</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Última vez</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leads.map(lead => (
                        <tr
                          key={lead.id}
                          onClick={() => toggleLead(lead.id)}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.has(lead.id)}
                              onChange={() => toggleLead(lead.id)}
                              onClick={e => e.stopPropagation()}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground">{lead.name}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{lead.phone}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{lead.reactivation_count ?? 0}×</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {lead.last_reactivated_at
                              ? format(new Date(lead.last_reactivated_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">Nenhum lead encontrado</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Mensagem ─────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setMessageMode('template'); setContextMessages({}) }}
                className={cn(
                  'flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-colors cursor-pointer',
                  messageMode === 'template'
                    ? 'border-alliance-blue bg-alliance-blue/5'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', messageMode === 'template' ? 'bg-alliance-blue/10' : 'bg-muted')}>
                  <Shuffle size={18} className={messageMode === 'template' ? 'text-alliance-blue' : 'text-muted-foreground'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Usar Template</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione um template e misture a mensagem para cada contato</p>
                </div>
              </button>

              <button
                onClick={() => { setMessageMode('context'); setMixedMessages({}); setSelectedTemplate(null) }}
                className={cn(
                  'flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-colors cursor-pointer',
                  messageMode === 'context'
                    ? 'border-alliance-blue bg-alliance-blue/5'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', messageMode === 'context' ? 'bg-alliance-blue/10' : 'bg-muted')}>
                  <Sparkles size={18} className={messageMode === 'context' ? 'text-alliance-blue' : 'text-muted-foreground'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Criar com Contexto</p>
                  <p className="text-xs text-muted-foreground mt-0.5">IA analisa o histórico e cria mensagem personalizada para reengajar</p>
                </div>
              </button>
            </div>

            {/* Template mode */}
            {messageMode === 'template' && (
              <div className="flex flex-col gap-4">
                {allContacts.some(c => c.id === null) && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <Phone size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Números manuais receberão variações do template. Apenas leads do CRM podem usar mensagens contextuais.
                    </p>
                  </div>
                )}

                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Selecionar template</h3>
                  </div>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <FileText size={28} className="text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">Nenhum template. Crie um na aba Templates.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-border max-h-[260px] overflow-y-auto">
                      {templates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTemplate(t); setMixedMessages({}) }}
                          className={cn(
                            'flex items-start gap-3 px-5 py-3.5 text-left transition-colors cursor-pointer w-full',
                            selectedTemplate?.id === t.id ? 'bg-alliance-blue/5' : 'hover:bg-muted/50',
                          )}
                        >
                          <div className={cn(
                            'w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                            selectedTemplate?.id === t.id ? 'bg-alliance-blue border-alliance-blue' : 'border-border',
                          )}>
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
                    <button
                      onClick={handleMixTemplate}
                      disabled={mixing}
                      className={cn(
                        'flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                        !mixing ? 'bg-alliance-blue text-white hover:bg-alliance-dark' : 'bg-muted text-muted-foreground cursor-not-allowed',
                      )}
                    >
                      {mixing
                        ? <><RefreshCw size={14} className="animate-spin" /> Misturando mensagens...</>
                        : <><Shuffle size={14} /> Misturar mensagem para {allContacts.length} contato{allContacts.length !== 1 ? 's' : ''}</>}
                    </button>

                    {mixError && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-500">{mixError}</p>
                      </div>
                    )}

                    {Object.keys(mixedMessages).length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Check size={13} className="text-green-600" />
                          <p className="text-xs font-semibold text-green-600">
                            {Object.keys(mixedMessages).length} variações geradas
                          </p>
                        </div>
                        {allContacts.slice(0, 3).map(c => {
                          const key = c.id ?? c.phone
                          const msg = mixedMessages[key]
                          if (!msg) return null
                          return (
                            <div key={key} className="px-4 py-3 bg-muted/50 rounded-xl border border-border">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{c.name}</p>
                              <p className="text-sm text-foreground">{msg}</p>
                            </div>
                          )
                        })}
                        {allContacts.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">+ {allContacts.length - 3} mais</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Context mode */}
            {messageMode === 'context' && (
              <div className="flex flex-col gap-4">
                {allContacts.some(c => c.id === null) && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {allContacts.filter(c => c.id === null).length} número{allContacts.filter(c => c.id === null).length !== 1 ? 's' : ''} manual não possui histórico no CRM e não será incluído neste modo.
                    </p>
                  </div>
                )}

                {/* Per-lead context inputs */}
                {allContacts.filter(c => c.id !== null).length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Contexto por lead <span className="font-normal normal-case">(opcional — enriquece a geração da IA)</span>
                      </p>
                      <button
                        onClick={() => handleGenerateContext('all')}
                        disabled={generatingContext}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                          !generatingContext
                            ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                            : 'bg-muted text-muted-foreground cursor-not-allowed',
                        )}
                      >
                        {generatingContextId === 'all'
                          ? <><RefreshCw size={11} className="animate-spin" /> Gerando...</>
                          : <><Sparkles size={11} /> Gerar todos</>}
                      </button>
                    </div>

                    {allContacts.filter(c => c.id !== null).map(c => {
                      const leadId = c.id!
                      const hasMessage = !!contextMessages[leadId]
                      const isGenerating = generatingContextId === leadId
                      return (
                        <div
                          key={leadId}
                          className={cn(
                            'flex flex-col gap-3 p-4 rounded-2xl border transition-colors',
                            hasMessage ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card',
                          )}
                        >
                          {/* Lead header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                                hasMessage ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
                              )}>
                                {hasMessage ? <Check size={12} /> : c.name.charAt(0).toUpperCase()}
                              </div>
                              <p className="text-sm font-semibold text-foreground">{c.name}</p>
                              <span className="text-xs font-mono text-muted-foreground">{c.phone.replace('@s.whatsapp.net', '')}</span>
                            </div>
                            <button
                              onClick={() => handleGenerateContext(leadId)}
                              disabled={generatingContext}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex-shrink-0',
                                !generatingContext
                                  ? hasMessage
                                    ? 'text-green-700 bg-green-500/10 hover:bg-green-500/20'
                                    : 'text-alliance-blue bg-alliance-blue/10 hover:bg-alliance-blue/20'
                                  : 'text-muted-foreground bg-muted cursor-not-allowed',
                              )}
                            >
                              {isGenerating
                                ? <><RefreshCw size={10} className="animate-spin" /> Gerando...</>
                                : hasMessage
                                  ? <><RefreshCw size={10} /> Regerar</>
                                  : <><Sparkles size={10} /> Gerar</>}
                            </button>
                          </div>

                          {/* Manual context input */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Contexto manual (opcional)
                            </label>
                            <textarea
                              value={manualContexts[leadId] ?? ''}
                              onChange={e => setManualContexts(prev => ({ ...prev, [leadId]: e.target.value }))}
                              placeholder="Ex: estava interessada em apto de 3 quartos, mencionou que compraria em junho, preocupação com o valor de entrada..."
                              rows={2}
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/40"
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Adicione detalhes que a IA usará para gerar uma mensagem de reativação mais precisa e com sentido
                            </p>
                          </div>

                          {/* Generated message preview */}
                          {hasMessage && (
                            <div className="px-3 py-2.5 bg-background rounded-xl border border-green-500/20">
                              <p className="text-[10px] font-semibold text-green-700 dark:text-green-500 mb-1 uppercase tracking-wider">Mensagem gerada</p>
                              <p className="text-sm text-foreground">{contextMessages[leadId]}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {contextError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-500">{contextError}</p>
                  </div>
                )}

                {Object.keys(contextMessages).length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Check size={13} className="text-green-600" />
                    <p className="text-xs font-semibold text-green-600">
                      {Object.keys(contextMessages).length} de {allContacts.filter(c => c.id !== null).length} mensagens geradas
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Configuração ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">

            {/* Campaign name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Nome da campanha <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="Ex: Reativação Maio 2026"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Interval */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Intervalo entre envios
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {INTERVAL_OPTIONS.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setIntervalOption(i)}
                    className={cn(
                      'px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors text-left cursor-pointer',
                      intervalOption === i
                        ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    <p className="font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cada contato recebe um intervalo aleatório nesta faixa
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl">
                <Timer size={13} className="text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  O sistema gera minutos, segundos e milissegundos aleatórios para cada contato dentro da faixa selecionada
                </p>
              </div>
            </div>

            {/* Typing delay info */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl">
              <Zap size={13} className="text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Delay de digitação:</span> entre 2 e 5 segundos aleatórios por contato — simula digitação humana
              </p>
            </div>

            {/* Instance */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Instância WhatsApp <span className="text-red-500">*</span>
                </label>
              </div>
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

        {/* ── STEP 4: Resumo ───────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col gap-5">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total de contatos</p>
                <p className="text-2xl font-bold text-foreground">{schedule.length}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Tempo estimado</p>
                <p className="text-2xl font-bold text-foreground">{formatEstimated(estimatedMs)}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                <p className="text-2xl font-bold text-foreground">{INTERVAL_OPTIONS[intervalOption]?.label}</p>
              </div>
            </div>

            {/* Campaign name preview */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/50 rounded-xl">
              <Send size={14} className="text-alliance-blue flex-shrink-0" />
              <p className="text-sm text-foreground font-medium">{campaignName}</p>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-500">{saveError}</p>
              </div>
            )}

            {/* Schedule table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Cronograma de envios</h3>
              </div>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><Clock size={11} /> Intervalo</div>
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><Zap size={11} /> Delay</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.map((s, i) => (
                      <tr key={s.phone + i} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.phone.replace('@s.whatsapp.net', '')}</p>
                        </td>
                        <td className="px-5 py-3 max-w-[240px]">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {s.message || <span className="text-red-400 italic">sem mensagem</span>}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-mono text-foreground">
                            {formatIntervalDisplay(s.intervalMin, s.intervalSec, s.intervalMs)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{s.delayMs} ms</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={() => step === 1 ? router.push('/disparos') : goPrev()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </button>

        {step < 4 ? (
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
              canGoNext
                ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            Próximo <ArrowRight size={14} />
          </button>
        ) : (
          <motion.button
            onClick={handleSave}
            disabled={!canSave || saving}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
              canSave && !saving
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</>
              : <><Send size={14} /> Salvar e iniciar campanha</>}
          </motion.button>
        )}
      </div>
    </div>
  )
}
