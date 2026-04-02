import { InteracoesClient } from '@/components/interacoes/interacoes-client'
import type { LeadWithLastInteraction } from '@/components/interacoes/types'
import type { Lead, Interaction } from '@/lib/supabase/types'

async function getLeadsWithInteractions(): Promise<{ leads: LeadWithLastInteraction[], messages: Interaction[] }> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)

    const leads = (leadsData ?? []) as Lead[]
    if (leads.length === 0) return { leads: [], messages: [] }

    const leadIds = leads.map(l => l.id)

    const { data: interactionsData } = await supabase
      .from('interactions')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true })
      .limit(500)

    const interactions = (interactionsData ?? []) as Interaction[]

    // Itera do fim para o início: última mensagem de cada lead fica mapeada
    const lastByLead = new Map<string, Interaction>()
    for (let i = interactions.length - 1; i >= 0; i--) {
      const msg = interactions[i]
      if (!lastByLead.has(msg.lead_id)) lastByLead.set(msg.lead_id, msg)
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

    return { leads: leadsWithLast, messages: interactions }
  } catch {
    return { leads: [], messages: [] }
  }
}

export default async function InteracoesPage() {
  const { leads, messages } = await getLeadsWithInteractions()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <InteracoesClient leads={leads} initialMessages={messages} />
    </div>
  )
}
