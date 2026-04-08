import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { KanbanPageHeader } from '@/components/kanban/kanban-page-header'
import PageTransition from '@/components/layout/page-transition'
import { EmptyState } from '@/components/layout/empty-state'
import { ErrorState } from '@/components/layout/error-state'
import { Kanban } from 'lucide-react'
import type { Lead } from '@/lib/supabase/types'

type LeadsResult =
  | { ok: true; leads: Lead[] }
  | { ok: false }

async function getLeads(): Promise<LeadsResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) return { ok: false }
    return { ok: true, leads: data ?? [] }
  } catch {
    return { ok: false }
  }
}

export default async function KanbanPage() {
  const result = await getLeads()

  return (
    <PageTransition>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            {/* Eyebrow: text-label semântico */}
            <p className="text-label text-alliance-blue/60 uppercase tracking-widest mb-1">
              Pipeline
            </p>
            {/* Título de página: text-title semântico */}
            <h1 className="text-title text-alliance-dark">Leads</h1>
          </div>
          <KanbanPageHeader />
        </div>

        {/* Error state */}
        {!result.ok && (
          <div className="flex-1 flex items-center justify-center">
            <ErrorState
              title="Erro ao carregar leads"
              description="Nao foi possivel conectar ao banco de dados. Recarregue a pagina para tentar novamente."
            />
          </div>
        )}

        {/* Empty state global — nenhum lead no sistema */}
        {result.ok && result.leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Kanban size={32} />}
              title="Nenhum lead ainda"
              description="Os leads aparecerao aqui assim que chegarem via WhatsApp ou forem criados manualmente."
            />
          </div>
        )}

        {/* Board — horizontal scroll */}
        {result.ok && result.leads.length > 0 && (
          <div className="flex-1 overflow-hidden px-8 pb-6">
            <KanbanBoard initialLeads={result.leads} />
          </div>
        )}
      </div>
    </PageTransition>
  )
}
