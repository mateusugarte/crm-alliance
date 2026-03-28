import { createClient } from '@/lib/supabase/server'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import PageTransition from '@/components/layout/page-transition'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'

async function getUserName(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'CORRETOR'

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const profile = data as UserProfile | null
    return profile?.full_name?.toUpperCase() ?? 'CORRETOR'
  } catch {
    return 'CORRETOR'
  }
}

async function getMetrics() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('leads').select('*')
    const leads = (data ?? []) as Lead[]

    const today = new Date().toISOString().split('T')[0]
    const { data: mtgs } = await supabase
      .from('meetings')
      .select('id')
      .gte('datetime', today)
      .lt('datetime', today + 'T23:59:59')
      .eq('status', 'scheduled')

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

  return (
    <PageTransition>
      <div className="px-8 py-7 flex flex-col gap-7">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Bem-vindo de volta
          </p>
          <h1 className="text-3xl font-bold text-alliance-dark">
            {userName}
          </h1>
        </div>

        <MetricsGrid metrics={metrics} />
        <ChartsSection reunioes={chartData.reunioes} leads={chartData.leads} />
      </div>
    </PageTransition>
  )
}
