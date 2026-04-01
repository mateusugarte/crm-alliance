import { createClient } from '@/lib/supabase/server'
import { Smile } from 'lucide-react'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'

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
    const today = new Date().toISOString().split('T')[0]

    const [{ data: leadsData }, { data: mtgs }] = await Promise.all([
      supabase.from('leads').select('stage, interaction_count, automation_paused'),
      supabase
        .from('meetings')
        .select('id')
        .gte('datetime', today)
        .lt('datetime', today + 'T23:59:59')
        .eq('status', 'scheduled'),
    ])

    const leads = (leadsData ?? []) as Pick<Lead, 'stage' | 'interaction_count' | 'automation_paused'>[]

    return {
      leads: leads.length,
      reunioes: mtgs?.length ?? 0,
      sem_resposta: leads.filter(l => l.interaction_count === 0).length,
      aquecidos: leads.filter(l => l.stage === 'lead_quente').length,
      pausadas: leads.filter(l => l.automation_paused).length,
      disponiveis: leads.filter(l => l.stage === 'visita_confirmada' || l.stage === 'reuniao_agendada').length,
    }
  } catch {
    return { leads: 0, reunioes: 0, sem_resposta: 0, aquecidos: 0, pausadas: 0, disponiveis: 0 }
  }
}

async function getChartData() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const sevenDaysAgo = subDays(now, 6)
    const days = eachDayOfInterval({ start: sevenDaysAgo, end: now })
    const labels = days.map(d => format(d, 'dd/MM', { locale: ptBR }))

    const [{ data: mtgRows }, { data: leadRows }] = await Promise.all([
      supabase
        .from('meetings')
        .select('datetime')
        .gte('datetime', sevenDaysAgo.toISOString()),
      supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString()),
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
      format(subDays(new Date(), 6 - i), 'dd/MM', { locale: ptBR })
    )
    return {
      reunioes: { labels, data: [0, 0, 0, 0, 0, 0, 0] },
      leads: { labels, data: [0, 0, 0, 0, 0, 0, 0] },
    }
  }
}

export default async function DashboardPage() {
  const [userName, metrics, chartData] = await Promise.all([
    getUserName(),
    getMetrics(),
    getChartData(),
  ])

  const greeting = getGreeting()
  const dateLabel = getFormattedDate()

  return (
    <div className="px-8 py-7 flex flex-col gap-7 min-h-full">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              {greeting}
            </p>
            <h1 className="text-[1.75rem] font-bold text-gray-900 leading-tight flex items-center gap-2.5">
              {userName}
              <Smile size={26} className="text-alliance-blue flex-shrink-0" strokeWidth={1.75} />
            </h1>
          </div>
          <div className="text-right mt-1">
            <p className="text-xs text-gray-400 capitalize">{dateLabel}</p>
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-[11px] text-gray-400 font-medium">Sistema online</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent -mt-3" />

        <MetricsGrid metrics={metrics} />
        <ChartsSection reunioes={chartData.reunioes} leads={chartData.leads} />
      </div>
  )
}
