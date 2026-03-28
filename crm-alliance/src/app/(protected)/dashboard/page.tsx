import { createClient } from '@/lib/supabase/server'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import PageTransition from '@/components/layout/page-transition'
import { ErrorState } from '@/components/layout/error-state'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Lead, UserProfile } from '@/lib/supabase/types'

interface MetricsData {
  leads: number
  reunioes: number
  sem_resposta: number
  aquecidos: number
  pausadas: number
  disponiveis: number
}

interface ChartData {
  labels: string[]
  data: number[]
}

type DashboardResult =
  | { ok: true; userName: string; metrics: MetricsData; chartData: { reunioes: ChartData; leads: ChartData } }
  | { ok: false }

async function getUserName(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'CORRETOR'
  const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
  const profile = data as UserProfile | null
  return profile?.full_name?.toUpperCase() ?? 'CORRETOR'
}

async function getDashboardData(): Promise<DashboardResult> {
  try {
    const supabase = await createClient()

    const [userNameResult, leadsResult, mtgTodayResult] = await Promise.all([
      getUserName(supabase).catch(() => 'CORRETOR'),
      supabase.from('leads').select('*'),
      supabase
        .from('meetings')
        .select('id')
        .gte('datetime', new Date().toISOString().split('T')[0])
        .lt('datetime', new Date().toISOString().split('T')[0] + 'T23:59:59')
        .eq('status', 'scheduled'),
    ])

    if (leadsResult.error) return { ok: false }

    const leads = (leadsResult.data ?? []) as Lead[]
    const metrics: MetricsData = {
      leads: leads.length,
      reunioes: mtgTodayResult.data?.length ?? 0,
      sem_resposta: leads.filter(l => l.interaction_count === 0).length,
      aquecidos: leads.filter(l => l.stage === 'lead_quente').length,
      pausadas: leads.filter(l => l.automation_paused).length,
      disponiveis: leads.filter(l => l.stage === 'visita_confirmada' || l.stage === 'reuniao_agendada').length,
    }

    // Chart data
    const now = new Date()
    const sevenDaysAgo = subDays(now, 6)
    const days = eachDayOfInterval({ start: sevenDaysAgo, end: now })
    const labels = days.map(d => format(d, 'dd/MM', { locale: ptBR }))

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
      ok: true,
      userName: userNameResult,
      metrics,
      chartData: {
        reunioes: { labels, data: countByDay(mtgRows as Array<{ datetime: string }> ?? [], 'datetime') },
        leads: { labels, data: countByDay(leadRows as Array<{ created_at: string }> ?? [], 'created_at') },
      },
    }
  } catch {
    return { ok: false }
  }
}

export default async function DashboardPage() {
  const result = await getDashboardData()

  if (!result.ok) {
    return (
      <PageTransition>
        <div className="px-8 py-7 flex flex-col gap-7">
          <div>
            <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
              Bem-vindo de volta
            </p>
            <h1 className="text-3xl font-bold text-alliance-dark">Dashboard</h1>
          </div>
          <ErrorState
            title="Erro ao carregar metricas"
            description="Nao foi possivel conectar ao banco de dados. Recarregue a pagina para tentar novamente."
          />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="px-8 py-7 flex flex-col gap-7">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Bem-vindo de volta
          </p>
          <h1 className="text-3xl font-bold text-alliance-dark">
            {result.userName}
          </h1>
        </div>

        <MetricsGrid metrics={result.metrics} />
        <ChartsSection reunioes={result.chartData.reunioes} leads={result.chartData.leads} />
      </div>
    </PageTransition>
  )
}
