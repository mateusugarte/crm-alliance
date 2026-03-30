import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { KanbanPageHeader } from '@/components/kanban/kanban-page-header'
import PageTransition from '@/components/layout/page-transition'
import type { Lead } from '@/lib/supabase/types'

async function getLeadsAndUser(): Promise<{ leads: Lead[]; currentUserId: string }> {
  try {
    const supabase = await createClient()
    const [leadsResult, userResult] = await Promise.all([
      supabase.from('leads').select('*').order('updated_at', { ascending: false }),
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

export default async function KanbanPage() {
  const { leads, currentUserId } = await getLeadsAndUser()

  return (
    <PageTransition>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
              Pipeline
            </p>
            <h1 className="text-2xl font-bold text-alliance-dark">Leads</h1>
          </div>
          <KanbanPageHeader />
        </div>

        {/* Board — horizontal scroll */}
        <div className="flex-1 overflow-hidden px-8 pb-6">
          <KanbanBoard initialLeads={leads} currentUserId={currentUserId} />
        </div>
      </div>
    </PageTransition>
  )
}
