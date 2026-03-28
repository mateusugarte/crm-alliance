import { InteracoesClient } from '@/components/interacoes/interacoes-client'
import { ErrorState } from '@/components/layout/error-state'
import type { LeadWithLastInteraction } from '@/components/interacoes/types'
import type { Lead, Interaction } from '@/lib/supabase/types'

type InteracoesResult =
  | { ok: true; leads: LeadWithLastInteraction[]; messages: Interaction[] }
  | { ok: false }

async function getLeadsWithInteractions(): Promise<InteracoesResult> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (leadsError) return { ok: false }

    const leads = (leadsData ?? []) as Lead[]
    if (leads.length === 0) return { ok: true, leads: [], messages: [] }

    const leadIds = leads.map(l => l.id)

    const { data: interactionsData, error: intError } = await supabase
      .from('interactions')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(500)

    if (intError) return { ok: false }

    const interactions = (interactionsData ?? []) as Interaction[]

    const lastByLead = new Map<string, Interaction>()
    for (const i of interactions) {
      if (!lastByLead.has(i.lead_id)) lastByLead.set(i.lead_id, i)
    }

    const leadsWithLast: LeadWithLastInteraction[] = leads.map(l => {
      const last = lastByLead.get(l.id)
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        automation_paused: l.automation_paused,
        assigned_to: l.assigned_to,
        lastMessage: last?.content ?? 'Sem mensagens',
        lastMessageAt: last?.created_at ?? new Date().toISOString(),
      }
    }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

    return { ok: true, leads: leadsWithLast, messages: interactions }
  } catch {
    return { ok: false }
  }
}

export default async function InteracoesPage() {
  const result = await getLeadsWithInteractions()

  if (!result.ok) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <ErrorState
          title="Erro ao carregar conversas"
          description="Nao foi possivel conectar ao banco de dados. Recarregue a pagina para tentar novamente."
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <InteracoesClient leads={result.leads} initialMessages={result.messages} />
    </div>
  )
}
