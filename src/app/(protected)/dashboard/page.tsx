export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import { DisparosSection } from '@/components/dashboard/disparos-section'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DailyTaskCenter } from '@/components/dashboard/daily-task-center'
import { BusinessOperationsSection } from '@/components/dashboard/business-operations-section'
import { STAGES, STAGE_ORDER } from '@/lib/stages'
import {
  format, subDays, eachDayOfInterval, addDays, addBusinessDays,
  startOfDay, endOfDay, startOfWeek, startOfMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const MEETING_STAGE_KEYS = ['reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente']

type DisparoSnapshotRow = {
  lead_id: string | null
  sent_at: string | null
  responded_at: string | null
  advanced_at: string | null
  meeting_at: string | null
  became_client_at: string | null
}

export interface DisparoFunnelItem {
  key: string
  label: string
  value: number
  color: string
  conversionFromPrevious: number
}

export interface DisparoDashboardData {
  impactedLeads: number
  totalSent: number
  averageDispatchesPerLead: number
  respondedLeads: number
  responseRate: number
  advancedLeads: number
  advanceRate: number
  meetingLeads: number
  clientLeads: number
  coldZeroRemaining: number
  funnel: DisparoFunnelItem[]
}

export interface PipelineStage {
  key: string
  label: string
  shortLabel: string
  count: number
  /** Tokens vindos de `@/lib/stages` — nunca hex literal. */
  color: string
  soft: string
  ink: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getFormattedDate(): string {
  return format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })
}

// Retorna null para 'tudo' (sem filtro de data)
function getDateRange(period: string, from?: string, to?: string): { start: Date; end: Date } | null {
  if (!period || period === 'tudo') return null
  const now = new Date()
  switch (period) {
    case 'hoje':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'mes':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'personalizado':
      if (from && to) {
        return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) }
      }
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
    default: // semana
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
  }
}

async function getUserName(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Corretor'

    const { data } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const profile = data as Pick<UserProfile, 'full_name'> | null
    if (profile?.full_name) {
      const firstName = profile.full_name.split(' ')[0]
      return firstName!.charAt(0).toUpperCase() + firstName!.slice(1).toLowerCase()
    }
    return user.email?.split('@')[0] ?? 'Corretor'
  } catch {
    return 'Corretor'
  }
}

async function getMetrics(dateRange: { start: Date; end: Date } | null) {
  try {
    const supabase = await createClient()

    const [{ data: leadsData }, { data: eventsData }] = await Promise.all([
      supabase.from('leads')
        .select('id,created_at,stage,interaction_count,automation_paused,reactivation_count,primeira_ligacao_em,aceitou_consultor'),
      dateRange
        ? supabase.from('lead_stage_events').select('lead_id,to_stage').neq('origem', 'backfill')
          .gte('changed_at', dateRange.start.toISOString()).lte('changed_at', dateRange.end.toISOString())
        : Promise.resolve({ data: null }),
    ])

    const leads = (leadsData ?? []) as Pick<Lead, 'id' | 'created_at' | 'stage' | 'interaction_count' | 'automation_paused' | 'reactivation_count' | 'primeira_ligacao_em' | 'aceitou_consultor'>[]
    const events = (eventsData ?? []) as Array<{ lead_id: string; to_stage: string }>
    const idsAtStage = (stage: string) => new Set(events.filter(event => event.to_stage === stage).map(event => event.lead_id))
    const meetingEventIds = new Set(events.filter(event => MEETING_STAGE_KEYS.includes(event.to_stage)).map(event => event.lead_id))
    const periodLeads = dateRange
      ? leads.filter(lead => lead.created_at >= dateRange.start.toISOString() && lead.created_at <= dateRange.end.toISOString())
      : leads
    const meetingStageCount = dateRange ? meetingEventIds.size : leads.filter(l => MEETING_STAGE_KEYS.includes(l.stage)).length
    const hotIds = idsAtStage('lead_quente')

    return {
      total_leads: leads.length,
      chegaram_reuniao: meetingStageCount,
      follow_up: dateRange ? idsAtStage('follow_up').size : leads.filter(l => l.stage === 'follow_up').length,
      sem_interesse: dateRange ? idsAtStage('sem_interesse').size : leads.filter(l => l.stage === 'sem_interesse').length,
      vendas: dateRange
        ? new Set([...idsAtStage('visita_confirmada'), ...idsAtStage('cliente')]).size
        : leads.filter(l => l.stage === 'visita_confirmada' || l.stage === 'cliente').length,
      sem_resposta_contexto: periodLeads.filter(l => l.interaction_count === 0).length,
      frios_sem_disparo: periodLeads.filter(l => l.stage === 'lead_frio' && (l.reactivation_count ?? 0) === 0).length,
      aquecidos: dateRange ? hotIds.size : leads.filter(l => l.stage === 'lead_quente').length,
      aguardando_primeiro_contato: leads.filter(l =>
        (dateRange ? hotIds.has(l.id) : l.stage === 'lead_quente') && !l.primeira_ligacao_em,
      ).length,
      pausadas: leads.filter(l => l.automation_paused).length,
    }
  } catch {
    return {
      total_leads: 0,
      chegaram_reuniao: 0,
      follow_up: 0,
      sem_interesse: 0,
      vendas: 0,
      sem_resposta_contexto: 0,
      frios_sem_disparo: 0,
      aquecidos: 0,
      aguardando_primeiro_contato: 0,
      pausadas: 0,
    }
  }
}

export interface BusinessOperationsData {
  unitsTotal: number
  postCrmUnitsSold: number
  postCrmVgv: number
  preCrmUnitsSold: number
  preCrmVgv: number
  totalUnitsSold: number
  totalSoldVgv: number
  commercialBaselineDate: string | null
  salesFromDispatch: number
  nextMeetings: Array<{ id: string; leadName: string; datetime: string }>
  meetingAttendanceRate: number
  firstCallMedianHours: number | null
  firstCallAverageHours: number | null
  rescueWorked: number
  rescueTotal: number
  rescueForecast: string | null
  weeklyCalls: number
  weeklyAnswered: number
  weeklyPauses: number
  wrongNumbers: number
  lossReasons: Array<{ reason: string; count: number }>
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(-11)
}

function saleValue(sale: {
  valor_entrada: number | null
  valor_financiado: number | null
  parcelas_direto: number | null
  valor_parcela_direto: number | null
}) {
  return Number(sale.valor_entrada ?? 0)
    + Number(sale.valor_financiado ?? 0)
    + Number(sale.parcelas_direto ?? 0) * Number(sale.valor_parcela_direto ?? 0)
}

async function getBusinessOperationsData(): Promise<BusinessOperationsData> {
  const empty: BusinessOperationsData = {
    unitsTotal: 34, postCrmUnitsSold: 0, postCrmVgv: 0, preCrmUnitsSold: 0, preCrmVgv: 0,
    totalUnitsSold: 0, totalSoldVgv: 0, commercialBaselineDate: null,
    salesFromDispatch: 0, nextMeetings: [],
    meetingAttendanceRate: 0, firstCallMedianHours: null, firstCallAverageHours: null,
    rescueWorked: 0, rescueTotal: 0, rescueForecast: null, weeklyCalls: 0,
    weeklyAnswered: 0, weeklyPauses: 0, wrongNumbers: 0, lossReasons: [],
  }

  try {
    const supabase = await createClient()
    const db = supabase as unknown as SupabaseClient
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
    const nextWeek = addDays(now, 7).toISOString()

    const [leadsResult, meetingsResult, unitsResult, salesResult, callsResult, pausesResult, baselineResult] = await Promise.all([
      db.from('leads').select('id,name,phone,stage,via_disparo,qualificado_em,primeira_ligacao_em,resgate_status,motivo_perda,ultimo_desfecho'),
      db.from('meetings').select('id,lead_id,datetime,status').order('datetime', { ascending: true }),
      db.from('imoveis').select('id,vendido,valor_min,valor_max'),
      db.from('vendas').select('id,imovel_id,comprador_telefone,valor_entrada,valor_financiado,parcelas_direto,valor_parcela_direto'),
      db.from('ligacoes').select('desfecho,registrada_em').is('excluida_em', null).gte('registrada_em', weekStart),
      db.from('lead_automation_events').select('id').eq('paused', true).gte('changed_at', weekStart),
      db.from('configuracoes_sistema').select('valor').eq('chave', 'resultado_comercial').maybeSingle(),
    ])

    type LeadOps = {
      id: string; name: string; phone: string; stage: string; via_disparo: boolean | null
      qualificado_em: string | null; primeira_ligacao_em: string | null
      resgate_status: string; motivo_perda: string | null; ultimo_desfecho: string | null
    }
    type MeetingOps = { id: string; lead_id: string; datetime: string; status: string }
    type UnitOps = { id: string; vendido: boolean; valor_min: number | null; valor_max: number | null }
    type SaleOps = { id: string; imovel_id: string; comprador_telefone: string; valor_entrada: number | null; valor_financiado: number | null; parcelas_direto: number | null; valor_parcela_direto: number | null }
    const leads = (leadsResult.data ?? []) as LeadOps[]
    const meetings = (meetingsResult.data ?? []) as MeetingOps[]
    const sales = (salesResult.data ?? []) as SaleOps[]
    const units = (unitsResult.data ?? []) as UnitOps[]
    const unitMap = new Map(units.map(unit => [unit.id, unit]))
    const leadMap = new Map(leads.map(lead => [lead.id, lead]))
    const dispatchPhones = new Set(leads.filter(lead => lead.via_disparo).map(lead => normalizePhone(lead.phone)))

    const contactHours = leads.flatMap(lead => {
      if (!lead.qualificado_em || !lead.primeira_ligacao_em) return []
      const hours = (new Date(lead.primeira_ligacao_em).getTime() - new Date(lead.qualificado_em).getTime()) / 3_600_000
      return hours >= 0 ? [hours] : []
    }).sort((a, b) => a - b)
    const median = contactHours.length
      ? contactHours.length % 2
        ? contactHours[Math.floor(contactHours.length / 2)]!
        : (contactHours[contactHours.length / 2 - 1]! + contactHours[contactHours.length / 2]!) / 2
      : null
    const average = contactHours.length ? contactHours.reduce((sum, value) => sum + value, 0) / contactHours.length : null

    const rescuePool = leads.filter(lead =>
      ['lead_morno', 'lead_quente', 'follow_up', 'reuniao_agendada'].includes(lead.stage)
      && ['elegivel', 'na_fila', 'trabalhado', 'arquivado'].includes(lead.resgate_status),
    )
    const rescueWorked = rescuePool.filter(lead => ['trabalhado', 'arquivado'].includes(lead.resgate_status)).length
    const remainingDays = Math.ceil(Math.max(0, rescuePool.length - rescueWorked) / 3)
    const completedMeetings = meetings.filter(meeting => meeting.status === 'completed').length
    const closedMeetings = meetings.filter(meeting => meeting.status === 'completed' || meeting.status === 'cancelled').length
    const reasons = new Map<string, number>()
    for (const lead of leads) {
      if (!lead.motivo_perda) continue
      const reason = lead.motivo_perda.split(':')[0]?.trim() || 'Outro'
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }

    const postCrmVgv = sales.reduce((sum, sale) => {
      const declared = saleValue(sale)
      if (declared > 0) return sum + declared
      const unit = unitMap.get(sale.imovel_id)
      if (!unit) return sum
      const min = Number(unit.valor_min ?? unit.valor_max ?? 0)
      const max = Number(unit.valor_max ?? unit.valor_min ?? 0)
      return sum + ((min + max) / 2)
    }, 0)
    const postCrmUnitsSold = new Set(sales.map(sale => sale.imovel_id)).size
    const baseline = (baselineResult.data?.valor ?? {}) as {
      inventory_total?: number
      sold_total?: number
      sold_vgv_estimated?: number
      reference_date?: string
    }
    const unitsTotal = Math.max(Number(baseline.inventory_total ?? 34), units.length)
    const totalUnitsSold = Math.max(postCrmUnitsSold, Number(baseline.sold_total ?? postCrmUnitsSold))
    const totalSoldVgv = Math.max(postCrmVgv, Number(baseline.sold_vgv_estimated ?? postCrmVgv))

    return {
      unitsTotal,
      postCrmUnitsSold,
      postCrmVgv,
      preCrmUnitsSold: Math.max(0, totalUnitsSold - postCrmUnitsSold),
      preCrmVgv: Math.max(0, totalSoldVgv - postCrmVgv),
      totalUnitsSold,
      totalSoldVgv,
      commercialBaselineDate: baseline.reference_date ?? null,
      salesFromDispatch: sales.filter(sale => dispatchPhones.has(normalizePhone(sale.comprador_telefone))).length,
      nextMeetings: meetings
        .filter(meeting => meeting.status === 'scheduled' && meeting.datetime >= now.toISOString() && meeting.datetime <= nextWeek)
        .slice(0, 5)
        .map(meeting => ({ id: meeting.id, leadName: leadMap.get(meeting.lead_id)?.name ?? 'Lead', datetime: meeting.datetime })),
      meetingAttendanceRate: closedMeetings ? (completedMeetings / closedMeetings) * 100 : 0,
      firstCallMedianHours: median,
      firstCallAverageHours: average,
      rescueWorked,
      rescueTotal: rescuePool.length,
      rescueForecast: remainingDays ? format(addBusinessDays(now, remainingDays), 'dd/MM/yyyy') : null,
      weeklyCalls: callsResult.data?.length ?? 0,
      weeklyAnswered: callsResult.data?.filter((call: { desfecho: string }) => call.desfecho === 'atendeu').length ?? 0,
      weeklyPauses: pausesResult.data?.length ?? 0,
      wrongNumbers: leads.filter(lead => lead.ultimo_desfecho === 'numero_errado').length,
      lossReasons: Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 4),
    }
  } catch {
    return empty
  }
}

function uniqueLeadCount(rows: DisparoSnapshotRow[], predicate: (row: DisparoSnapshotRow) => boolean) {
  return new Set(rows.filter(row => row.lead_id && predicate(row)).map(row => row.lead_id as string)).size
}

function rate(part: number, total: number) {
  if (!total) return 0
  return (part / total) * 100
}

async function getDisparoDashboardData(dateRange: { start: Date; end: Date } | null): Promise<DisparoDashboardData> {
  try {
    const supabase = await createClient()

    let snapshotsQuery = supabase
      .from('disparo_lead_snapshots')
      .select('lead_id, sent_at, responded_at, advanced_at, meeting_at, became_client_at')
    if (dateRange) snapshotsQuery = snapshotsQuery
      .gte('impacted_at', dateRange.start.toISOString())
      .lte('impacted_at', dateRange.end.toISOString())

    const [{ data: snapshotsRaw }, { data: coldZeroRaw }] = await Promise.all([
      snapshotsQuery,
      supabase
        .from('leads')
        .select('id')
        .eq('stage', 'lead_frio')
        .eq('reactivation_count', 0),
    ])

    const snapshots = (snapshotsRaw ?? []) as DisparoSnapshotRow[]
    const sentSnapshots = snapshots.filter(row => !!row.sent_at)
    const impactedLeads = uniqueLeadCount(sentSnapshots, () => true)
    const totalSent = sentSnapshots.length
    const respondedLeads = uniqueLeadCount(sentSnapshots, row => !!row.responded_at)
    const advancedLeads = uniqueLeadCount(sentSnapshots, row => !!row.advanced_at)
    const meetingLeads = uniqueLeadCount(sentSnapshots, row => !!row.meeting_at)
    const clientLeads = uniqueLeadCount(sentSnapshots, row => !!row.became_client_at)
    const averageDispatchesPerLead = impactedLeads > 0 ? totalSent / impactedLeads : 0

    const funnelBase = [
      { key: 'impactados', label: 'Impactados', value: impactedLeads, color: 'var(--brand)' },
      { key: 'responderam', label: 'Responderam', value: respondedLeads, color: 'var(--stage-frio)' },
      { key: 'avancaram', label: 'Avançaram no pipeline', value: advancedLeads, color: 'var(--stage-morno)' },
      { key: 'reunioes', label: 'Agendaram reunião', value: meetingLeads, color: 'var(--stage-reuniao)' },
      { key: 'clientes', label: 'Viraram cliente', value: clientLeads, color: 'var(--stage-cliente)' },
    ]

    const funnel = funnelBase.map((item, index) => ({
      ...item,
      conversionFromPrevious: index === 0
        ? 100
        : rate(item.value, funnelBase[index - 1]?.value ?? 0),
    }))

    return {
      impactedLeads,
      totalSent,
      averageDispatchesPerLead,
      respondedLeads,
      responseRate: rate(respondedLeads, impactedLeads),
      advancedLeads,
      advanceRate: rate(advancedLeads, impactedLeads),
      meetingLeads,
      clientLeads,
      coldZeroRemaining: coldZeroRaw?.length ?? 0,
      funnel,
    }
  } catch {
    const emptyFunnel = [
      { key: 'impactados', label: 'Impactados', value: 0, color: 'var(--brand)', conversionFromPrevious: 100 },
      { key: 'responderam', label: 'Responderam', value: 0, color: 'var(--stage-frio)', conversionFromPrevious: 0 },
      { key: 'avancaram', label: 'Avançaram no pipeline', value: 0, color: 'var(--stage-morno)', conversionFromPrevious: 0 },
      { key: 'reunioes', label: 'Agendaram reunião', value: 0, color: 'var(--stage-reuniao)', conversionFromPrevious: 0 },
      { key: 'clientes', label: 'Viraram cliente', value: 0, color: 'var(--stage-cliente)', conversionFromPrevious: 0 },
    ]

    return {
      impactedLeads: 0,
      totalSent: 0,
      averageDispatchesPerLead: 0,
      respondedLeads: 0,
      responseRate: 0,
      advancedLeads: 0,
      advanceRate: 0,
      meetingLeads: 0,
      clientLeads: 0,
      coldZeroRemaining: 0,
      funnel: emptyFunnel,
    }
  }
}

// Gráficos usam o filtro de período (padrão: últimos 30 dias para 'tudo')
async function getChartData(dateRange: { start: Date; end: Date } | null) {
  try {
    const supabase = await createClient()

    const now = new Date()
    const effectiveStart = dateRange?.start ?? subDays(now, 29)
    const effectiveEnd   = dateRange?.end   ?? endOfDay(now)

    const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd }).slice(0, 31)
    const displayFormat = days.length <= 7 ? 'EEE' : 'dd/MM'
    const labels = days.map(d => format(d, displayFormat, { locale: ptBR }).replace('.', ''))

    const { data: leadRows } = await supabase.from('leads').select('created_at')
      .gte('created_at', effectiveStart.toISOString())
      .lte('created_at', effectiveEnd.toISOString())

    const countByDay = (rows: Array<{ [key: string]: string }>, field: string) =>
      days.map(d => {
        const key = format(d, 'dd/MM', { locale: ptBR })
        return (rows ?? []).filter(r => {
          const rowLabel = format(new Date(r[field]!), 'dd/MM', { locale: ptBR })
          return rowLabel === key
        }).length
      })

    return { labels, data: countByDay(leadRows as Array<{ created_at: string }> ?? [], 'created_at') }
  } catch {
    const labels = Array.from({ length: 7 }, (_, i) =>
      format(subDays(new Date(), 6 - i), 'EEE', { locale: ptBR }).replace('.', '')
    )
    return { labels, data: [0, 0, 0, 0, 0, 0, 0] }
  }
}

async function getPipelineDistribution(dateRange: { start: Date; end: Date } | null): Promise<PipelineStage[]> {
  try {
    const supabase = await createClient()
    const { data } = dateRange
      ? await supabase.from('lead_stage_events').select('lead_id,to_stage').neq('origem', 'backfill')
        .gte('changed_at', dateRange.start.toISOString()).lte('changed_at', dateRange.end.toISOString())
      : await supabase.from('leads').select('stage')
    const rows = (data ?? []) as Array<{ stage?: string; lead_id?: string; to_stage?: string }>

    return STAGE_ORDER.map((key) => {
      const { label, shortLabel, solid, soft, ink } = STAGES[key]
      return {
        key,
        label,
        shortLabel,
        color: solid,
        soft,
        ink,
        count: dateRange
          ? new Set(rows.filter(row => row.to_stage === key).map(row => row.lead_id)).size
          : rows.filter(row => row.stage === key).length,
      }
    })
  } catch {
    return []
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const dateRange = getDateRange(params.period ?? 'tudo', params.from, params.to)

  const [userName, metrics, leadChartData, pipeline, disparos, businessOperations] = await Promise.all([
    getUserName(),
    getMetrics(dateRange),
    getChartData(dateRange),
    getPipelineDistribution(dateRange),
    getDisparoDashboardData(dateRange),
    getBusinessOperationsData(),
  ])

  const greeting = getGreeting()
  const dateLabel = getFormattedDate()

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-6 lg:px-8">
      <DashboardHero
        greeting={greeting}
        userName={userName}
        dateLabel={dateLabel}
        totalLeads={metrics.total_leads}
      />

      <DailyTaskCenter />

      <MetricsGrid metrics={metrics} />
      <ChartsSection
        leads={leadChartData}
        pipeline={pipeline}
      />
      <DisparosSection data={disparos} />
      <BusinessOperationsSection data={businessOperations} />
    </div>
  )
}
