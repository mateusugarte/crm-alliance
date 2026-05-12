export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { KanbanPageHeader } from '@/components/kanban/kanban-page-header'
import { DateFilter } from '@/components/ui/date-filter'
import { startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns'
import type { Lead } from '@/lib/supabase/types'

function getDateRange(period: string, from?: string, to?: string): { start: Date; end: Date } {
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
    // falls through to semana
    default:
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
  }
}

async function getLeadsAndUser(start: Date, end: Date): Promise<{ leads: Lead[]; currentUserId: string }> {
  try {
    const supabase = await createClient()
    const [leadsResult, userResult] = await Promise.all([
      supabase.from('leads')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('updated_at', { ascending: false }),
      supabase.auth.getUser(),
    ])
    return {
      leads: leadsResult.data ?? [],
      currentUserId: userResult.data.user?.id ?? '',
    }
  } catch {
    return { leads: [], currentUserId: '' }
  }
}

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const { start, end } = getDateRange(params.period ?? 'semana', params.from, params.to)
  const { leads, currentUserId } = await getLeadsAndUser(start, end)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Pipeline
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark">Leads</h1>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <DateFilter />
          </Suspense>
          <KanbanPageHeader />
        </div>
      </div>

      {/* Board — horizontal scroll */}
      <div className="flex-1 overflow-hidden px-8 pb-6">
        <KanbanBoard initialLeads={leads} currentUserId={currentUserId} />
      </div>
    </div>
  )
}
