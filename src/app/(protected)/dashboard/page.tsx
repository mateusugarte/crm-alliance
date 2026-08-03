export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Smile } from 'lucide-react'
import { Suspense } from 'react'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import { DisparosSection } from '@/components/dashboard/disparos-section'
import { DateFilter } from '@/components/ui/date-filter'
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

export interface TodayMeeting {
  id: string
  datetime: string
  lead_name: string
  consultant_name: string
  consultant_color: string
}

export interface PipelineStage {
  key: string
  label: string
  count: number
  color: string
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
      { key: 'impactados', label: 'Impactados', value: impactedLeads, color: '#0A2EAD' },
      { key: 'responderam', label: 'Responderam', value: respondedLeads, color: '#1E90FF' },
      { key: 'avancaram', label: 'Avançaram no pipeline', value: advancedLeads, color: '#FF8C00' },
      { key: 'reunioes', label: 'Agendaram reunião', value: meetingLeads, color: '#228B22' },
      { key: 'clientes', label: 'Viraram cliente', value: clientLeads, color: '#2ECC71' },
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
      { key: 'impactados', label: 'Impactados', value: 0, color: '#0A2EAD', conversionFromPrevious: 100 },
      { key: 'responderam', label: 'Responderam', value: 0, color: '#1E90FF', conversionFromPrevious: 0 },
      { key: 'avancaram', label: 'Avançaram no pipeline', value: 0, color: '#FF8C00', conversionFromPrevious: 0 },
      { key: 'reunioes', label: 'Agendaram reunião', value: 0, color: '#228B22', conversionFromPrevious: 0 },
      { key: 'clientes', label: 'Viraram cliente', value: 0, color: '#2ECC71', conversionFromPrevious: 0 },
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

    const [{ data: meetingStageRows }, { count: totalMeetingStages }, { data: leadRows }] = await Promise.all([
      supabase.from('leads').select('updated_at')
        .in('stage', MEETING_STAGE_KEYS)
        .gte('updated_at', effectiveStart.toISOString())
        .lte('updated_at', effectiveEnd.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .in('stage', MEETING_STAGE_KEYS),
      supabase.from('leads').select('created_at')
        .gte('created_at', effectiveStart.toISOString())
        .lte('created_at', effectiveEnd.toISOString()),
    ])

    const countByDay = (rows: Array<{ [key: string]: string }>, field: string) =>
      days.map(d => {
        const key = format(d, 'dd/MM', { locale: ptBR })
        return (rows ?? []).filter(r => {
          const rowLabel = format(new Date(r[field]!), 'dd/MM', { locale: ptBR })
          return rowLabel === key
        }).length
      })

    return {
      reunioes: {
        labels,
        data: countByDay(meetingStageRows as Array<{ updated_at: string }> ?? [], 'updated_at'),
        total: totalMeetingStages ?? 0,
      },
      leads: { labels, data: countByDay(leadRows as Array<{ created_at: string }> ?? [], 'created_at') },
    }
  } catch {
    const labels = Array.from({ length: 7 }, (_, i) =>
      format(subDays(new Date(), 6 - i), 'EEE', { locale: ptBR }).replace('.', '')
    )
    return {
      reunioes: { labels, data: [0, 0, 0, 0, 0, 0, 0], total: 0 },
      leads:    { labels, data: [0, 0, 0, 0, 0, 0, 0] },
    }
  }
}

async function getTodayMeetings(): Promise<TodayMeeting[]> {
  try {
    const supabase = await createClient()
    const now = new Date()
    const todayStart = startOfDay(now).toISOString()
    const todayEnd = endOfDay(now).toISOString()

    const { data: rawData } = await supabase
      .from('meetings')
      .select('id, datetime, lead_id, assigned_to')
      .gte('datetime', todayStart)
      .lte('datetime', todayEnd)
      .eq('status', 'scheduled')
      .order('datetime', { ascending: true })
      .limit(4)

    const data = (rawData ?? []) as Array<{ id: string; datetime: string; lead_id: string; assigned_to: string | null }>

    if (!data.length) return []

    const leadIds = [...new Set(data.map(m => m.lead_id).filter(Boolean))]
    const userIds = [...new Set(data.map(m => m.assigned_to).filter((x): x is string => x !== null))]

    const [{ data: leadsData }, { data: profilesData }] = await Promise.all([
      supabase.from('leads').select('id, name').in('id', leadIds),
      userIds.length
        ? supabase.from('user_profiles').select('id, full_name, badge_color').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ])

    const leadMap = new Map((leadsData ?? []).map((l: { id: string; name: string }) => [l.id, l.name]))
    const profileMap = new Map((profilesData ?? []).map((p: { id: string; full_name: string; badge_color: string }) => [p.id, p]))

    return data.map(m => {
      const profile = m.assigned_to ? profileMap.get(m.assigned_to) : null
      return {
        id: m.id,
        datetime: m.datetime,
        lead_name: leadMap.get(m.lead_id) ?? 'Lead',
        consultant_name: (profile as { full_name: string } | null)?.full_name ?? 'Não atribuído',
        consultant_color: (profile as { badge_color: string } | null)?.badge_color ?? '#1E90FF',
      }
    })
  } catch {
    return []
  }
}

async function getPipelineDistribution(): Promise<PipelineStage[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('leads').select('stage')
    const leads = (data ?? []) as Array<{ stage: string }>

    const STAGES: Array<{ key: string; label: string; color: string }> = [
      { key: 'nao_respondeu',     label: 'Não Respondeu', color: '#64748B' },
      { key: 'lead_frio',         label: 'Lead Frio',     color: '#1E90FF' },
      { key: 'lead_morno',        label: 'Lead Morno',    color: '#FF8C00' },
      { key: 'lead_quente',       label: 'Lead Quente',   color: '#FF4500' },
      { key: 'follow_up',         label: 'Follow-up',     color: '#9B59B6' },
      { key: 'sem_interesse',     label: 'Sem interesse', color: '#991B1B' },
      { key: 'reuniao_agendada',  label: 'Reunião',       color: '#228B22' },
      { key: 'visita_confirmada', label: 'Venda',         color: '#E67E22' },
      { key: 'cliente',           label: 'Cliente',       color: '#2ECC71' },
    ]

    return STAGES.map(s => ({
      ...s,
      count: leads.filter(l => l.stage === s.key).length,
    }))
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

  const [userName, metrics, chartData, todayMeetings, pipeline, disparos] = await Promise.all([
    getUserName(),
    getMetrics(),
    getChartData(dateRange),
    getTodayMeetings(),
    getPipelineDistribution(),
    getDisparoDashboardData(),
  ])

  const greeting = getGreeting()
  const dateLabel = getFormattedDate()

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest mb-1.5">
            {greeting}
          </p>
          <h1 className="text-[1.75rem] font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2.5">
            {userName}
            <Smile size={26} className="text-alliance-blue flex-shrink-0" strokeWidth={1.75} />
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2 mt-1">
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-white/40 capitalize">{dateLabel}</p>
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-[11px] text-gray-400 dark:text-white/30 font-medium">Sistema online</span>
            </div>
          </div>
          <Suspense fallback={null}>
            <DateFilter />
          </Suspense>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent -mt-2" />

      <MetricsGrid metrics={metrics} />
      <ChartsSection
        reunioes={chartData.reunioes}
        leads={chartData.leads}
        todayMeetings={todayMeetings}
        pipeline={pipeline}
      />
      <DisparosSection data={disparos} />
    </div>
  )
}
