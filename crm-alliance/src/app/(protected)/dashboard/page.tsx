import { createClient } from '@/lib/supabase/server'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ChartsSection } from '@/components/dashboard/charts-section'
import PageTransition from '@/components/layout/page-transition'

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
      sem_resposta: leads.filter(l => l.stage === 'lead_frio').length,
      aquecidos: leads.filter(l => l.stage === 'lead_quente' || l.stage === 'lead_morno').length,
      pausadas: leads.filter(l => l.automation_paused).length,
      disponiveis: leads.filter(l => l.stage === 'visita_confirmada' || l.stage === 'reuniao_agendada').length,
    }
  } catch {
    return { leads: 0, reunioes: 0, sem_resposta: 0, aquecidos: 0, pausadas: 0, disponiveis: 0 }
  }
}

export default async function DashboardPage() {
  const [userName, metrics] = await Promise.all([getUserName(), getMetrics()])

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-alliance-blue">
          BEM-VINDO, {userName}!
        </h1>
        <MetricsGrid metrics={metrics} />
        <ChartsSection />
      </div>
    </PageTransition>
  )
}
