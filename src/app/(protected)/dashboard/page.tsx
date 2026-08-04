export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import { DisparosSection } from '@/components/dashboard/disparos-section'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { STAGES, STAGE_ORDER } from '@/lib/stages'
import {
  format, subDays, eachDayOfInterval,
  startOfDay, endOfDay, startOfWeek, startOfMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'

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

// Métricas sempre mostram TODOS os leads (sem filtro de data)
async function getMetrics() {
  try {
    const supabase = await createClient()

    const [{ data: leadsData }] = await Promise.all([
      supabase.from('leads')
        .select('stage, interaction_count, automation_paused, lead_score, lead_score_band'),
    ])

    const leads = (leadsData ?? []) as Pick<Lead, 'stage' | 'interaction_count' | 'automation_paused' | 'lead_score' | 'lead_score_band'>[]
    const scoreAverage = (items: typeof leads) => items.length > 0
      ? items.reduce((sum, lead) => sum + (lead.lead_score ?? 0), 0) / items.length / 10
      : 0
    const meetingStageCount = leads.filter(l => MEETING_STAGE_KEYS.includes(l.stage)).length
    const coldLeads = leads.filter(l => l.stage === 'lead_frio')
    const warmLeads = leads.filter(l => l.stage === 'lead_morno')
    const hotLeads = leads.filter(l => l.stage === 'lead_quente')

    return {
      total_leads: leads.length,
      reunioes: meetingStageCount,
      sem_resposta: leads.filter(l => l.interaction_count === 0).length,
      aquecidos: leads.filter(l => l.stage === 'lead_quente').length,
      pausadas: leads.filter(l => l.automation_paused).length,
      disponiveis: meetingStageCount,
      score_medio: scoreAverage(leads),
      score_medio_frio: scoreAverage(coldLeads),
      score_medio_morno: scoreAverage(warmLeads),
      score_medio_quente: scoreAverage(hotLeads),
    }
  } catch {
    return {
      total_leads: 0,
      reunioes: 0,
      sem_resposta: 0,
      aquecidos: 0,
      pausadas: 0,
      disponiveis: 0,
      score_medio: 0,
      score_medio_frio: 0,
      score_medio_morno: 0,
      score_medio_quente: 0,
    }
  }
}

function uniqueLeadCount(rows: DisparoSnapshotRow[], predicate: (row: DisparoSnapshotRow) => boolean) {
  return new Set(rows.filter(row => row.lead_id && predicate(row)).map(row => row.lead_id as string)).size
}

function rate(part: number, total: number) {
  if (!total) return 0
  return (part / total) * 100
}

async function getDisparoDashboardData(): Promise<DisparoDashboardData> {
  try {
    const supabase = await createClient()

    const [{ data: snapshotsRaw }, { data: coldZeroRaw }] = await Promise.all([
      supabase
        .from('disparo_lead_snapshots')
        .select('lead_id, sent_at, responded_at, advanced_at, meeting_at, became_client_at'),
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

async function getPipelineDistribution(): Promise<PipelineStage[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('leads').select('stage')
    const leads = (data ?? []) as Array<{ stage: string }>

    return STAGE_ORDER.map((key) => {
      const { label, shortLabel, solid, soft, ink } = STAGES[key]
      return {
        key,
        label,
        shortLabel,
        color: solid,
        soft,
        ink,
        count: leads.filter(l => l.stage === key).length,
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

  const [userName, metrics, leadChartData, pipeline, disparos] = await Promise.all([
    getUserName(),
    getMetrics(),
    getChartData(dateRange),
    getPipelineDistribution(),
    getDisparoDashboardData(),
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

      <MetricsGrid metrics={metrics} />
      <ChartsSection
        leads={leadChartData}
        pipeline={pipeline}
      />
      <DisparosSection data={disparos} />
    </div>
  )
}
