import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import PageTransition from '@/components/layout/page-transition'
import type { Lead } from '@/lib/supabase/types'

async function getLeads(): Promise<Lead[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}

export default async function KanbanPage() {
  const leads = await getLeads()

  return (
    <PageTransition>
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-alliance-dark">Pipeline de Leads</h1>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:border-alliance-dark hover:text-alliance-dark transition-colors">
              Etiquetas
            </button>
            <button className="px-4 py-2 text-sm font-semibold bg-alliance-dark text-white rounded-xl hover:bg-alliance-dark/90 transition-colors">
              + Novo Lead
            </button>
          </div>
        </div>
        <KanbanBoard initialLeads={leads} />
      </div>
    </PageTransition>
  )
}
