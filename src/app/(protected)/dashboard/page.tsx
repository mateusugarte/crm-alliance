import { createClient } from '@/lib/supabase/server'
import { Smile } from 'lucide-react'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'

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
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    }
    return user.email?.split('@')[0] ?? 'Corretor'
  } catch {
    return 'Corretor'
  }
}

async function getMetrics() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const todayStart = startOfDay(now).toISOString()
    const todayEnd = endOfDay(now).toISOString()
    const weekAgo = subDays(now, 7).toISOString()
    const twoWeeksAgo = subDays(now, 14).toISOString()

    const [{ data: leadsData }, { data: mtgs }, { data: prevLeads }, { data: prevMtgs }] = await Promise.all([
      supabase.from('leads').select('stage, interaction_count, automation_paused'),
      supabase.from('meetings').select('id').gte('datetime', todayStart).lte('datetime', todayEnd).eq('status', 'scheduled'),
      supabase.from('leads').select('id').gte('created_at', twoWeeksAgo).lt('created_at', weekAgo),
      supabase.from('meetings').select('id').gte('datetime', twoWeeksAgo).lt('datetime', weekAgo).eq('status', 'scheduled'),
    ])

    const leads = (leadsData ?? []) as Pick<Lead, 'stage' | 'interaction_count' | 'automation_paused'>[]
    const prevLeadCount = prevLeads?.length ?? 0
    const prevMtgCount = prevMtgs?.length ?? 0

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    return {
      leads: leads.length,
      reunioes: mtgs?.length ?? 0,
      sem_resposta: leads.filter(l => l.interaction_count === 0).length,
      aquecidos: leads.filter(l => l.stage === 'lead_quente').length,
      pausadas: leads.filter(l => l.automation_paused).length,
      disponiveis: leads.filter(l => l.stage === 'visita_confirmada' || l.stage === 'reuniao_agendada').length,
      trend_leads: calcTrend(leads.length, prevLeadCount),
      trend_reunioes: calcTrend(mtgs?.length ?? 0, prevMtgCount),
    }
  } catch {
    return { leads: 0, reunioes: 0, sem_resposta: 0, aquecidos: 0, pausadas: 0, disponiveis: 0, trend_leads: 0, trend_reunioes: 0 }
  }
}

async function getChartData() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const sevenDaysAgo = subDays(now, 6)
    const days = eachDayOfInterval({ start: sevenDaysAgo, end: now })
    const labels = days.map(d => format(d, 'EEE', { locale: ptBR }).replace('.', ''))

    const [{ data: mtgRows }, { data: leadRows }] = await Promise.all([
      supabase.from('meetings').select('datetime').gte('datetime', sevenDaysAgo.toISOString()),
      supabase.from('leads').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
    ])

    const countByDay = (rows: Array<{ [key: string]: string }>, field: string) =>
      days.map(d => {
        const key = format(d, 'dd/MM', { locale: ptBR })
        return (rows ?? []).filter(r => {
          const rowLabel = format(new Date(r[field]), 'dd/MM', { locale: ptBR })
          return rowLabel === key
        }).length
      })

    return {
      reunioes: { labels, data: countByDay(mtgRows as Array<{ datetime: string }> ?? [], 'datetime') },
      leads: { labels, data: countByDay(leadRows as Array<{ created_at: string }> ?? [], 'created_at') },
    }
  } catch {
    const labels = Array.from({ length: 7 }, (_, i) =>
      format(subDays(new Date(), 6 - i), 'EEE', { locale: ptBR }).replace('.', '')
    )
    return {
      reunioes: { labels, data: [0, 0, 0, 0, 0, 0, 0] },
      leads: { labels, data: [0, 0, 0, 0, 0, 0, 0] },
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
      { key: 'lead_frio', label: 'Frio', color: '#1E90FF' },
      { key: 'lead_morno', label: 'Morno', color: '#FF8C00' },
      { key: 'lead_quente', label: 'Quente', color: '#FF4500' },
      { key: 'follow_up', label: 'Follow-up', color: '#9B59B6' },
      { key: 'reuniao_agendada', label: 'Reunião', color: '#228B22' },
      { key: 'visita_confirmada', label: 'Visita', color: '#E67E22' },
      { key: 'cliente', label: 'Cliente', color: '#2ECC71' },
    ]

    return STAGES.map(s => ({
      ...s,
      count: leads.filter(l => l.stage === s.key).length,
    }))
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const [userName, metrics, chartData, todayMeetings, pipeline] = await Promise.all([
    getUserName(),
    getMetrics(),
    getChartData(),
    getTodayMeetings(),
    getPipelineDistribution(),
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
        <div className="text-right mt-1">
          <p className="text-xs text-gray-400 dark:text-white/40 capitalize">{dateLabel}</p>
          <div className="flex items-center gap-1.5 justify-end mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-[11px] text-gray-400 dark:text-white/30 font-medium">Sistema online</span>
          </div>
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
    </div>
  )
}
