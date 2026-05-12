import { InteracoesClient } from '@/components/interacoes/interacoes-client'
import type { LeadWithLastInteraction, LeadContact, Label } from '@/components/interacoes/types'
import type { Lead, Interaction } from '@/lib/supabase/types'

async function getLeadsData(): Promise<{
  conversations: LeadWithLastInteraction[]
  contacts: LeadContact[]
  messages: Interaction[]
  currentUserId: string
  allLabels: Label[]
}> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id ?? ''

    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)

    const leads = (leadsData ?? []) as Lead[]
    if (leads.length === 0) return { conversations: [], contacts: [], messages: [], currentUserId, allLabels: [] }

    const leadIds = leads.map(l => l.id)

    const [{ data: interactionsData }, { data: allLabelsData }] = await Promise.all([
      supabase
        .from('interactions')
        .select('*')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase.from('labels').select('id, name, color').order('name'),
    ])

    const interactions = (interactionsData ?? []) as Interaction[]
    const allLabels = (allLabelsData ?? []) as Label[]

    // Última mensagem por lead
    const lastByLead = new Map<string, Interaction>()
    for (let i = interactions.length - 1; i >= 0; i--) {
      const msg = interactions[i]
      if (!lastByLead.has(msg.lead_id)) lastByLead.set(msg.lead_id, msg)
    }

    const conversations: LeadWithLastInteraction[] = []
    const contactLeadIds: string[] = []

    for (const l of leads) {
      const last = lastByLead.get(l.id)
      const base = {
        id: l.id,
        name: l.name,
        phone: l.phone,
        wa_contact_id: l.wa_contact_id,
        automation_paused: l.automation_paused,
        assigned_to: l.assigned_to,
        stage: l.stage,
        city: l.city,
        intention: l.intention,
        imovel_interesse: l.imovel_interesse,
        summary: l.summary,
        interaction_count: l.interaction_count,
        created_at: l.created_at,
      }
      if (last) {
        conversations.push({ ...base, lastMessage: last.content, lastMessageAt: last.created_at })
      } else {
        contactLeadIds.push(l.id)
      }
    }

    // Busca etiquetas dos contatos (sem conversas)
    let leadLabelsMap: Record<string, Label[]> = {}
    if (contactLeadIds.length > 0) {
      const { data: llData } = await supabase
        .from('lead_labels')
        .select('lead_id, label_id')
        .in('lead_id', contactLeadIds)

      const ll = (llData ?? []) as { lead_id: string; label_id: string }[]
      const labelMap = new Map(allLabels.map(l => [l.id, l]))
      for (const row of ll) {
        const label = labelMap.get(row.label_id)
        if (label) {
          leadLabelsMap[row.lead_id] = [...(leadLabelsMap[row.lead_id] ?? []), label]
        }
      }
    }

    const contacts: LeadContact[] = leads
      .filter(l => !lastByLead.has(l.id))
      .map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        wa_contact_id: l.wa_contact_id,
        automation_paused: l.automation_paused,
        assigned_to: l.assigned_to,
        stage: l.stage,
        city: l.city,
        intention: l.intention,
        imovel_interesse: l.imovel_interesse,
        summary: l.summary,
        interaction_count: l.interaction_count,
        created_at: l.created_at,
        labels: leadLabelsMap[l.id] ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    conversations.sort((a, b) => new Date(b.lastMessageAt!).getTime() - new Date(a.lastMessageAt!).getTime())

    return { conversations, contacts, messages: interactions, currentUserId, allLabels }
  } catch {
    return { conversations: [], contacts: [], messages: [], currentUserId: '', allLabels: [] }
  }
}

export default async function InteracoesPage() {
  const { conversations, contacts, messages, currentUserId, allLabels } = await getLeadsData()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <InteracoesClient
        conversations={conversations}
        contacts={contacts}
        initialMessages={messages}
        currentUserId={currentUserId}
        allLabels={allLabels}
      />
    </div>
  )
}
