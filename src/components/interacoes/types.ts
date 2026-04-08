export interface LeadWithLastInteraction {
  id: string
  name: string
  phone: string
  automation_paused: boolean
  assigned_to: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  // Campos para o painel de info
  stage: string
  city: string | null
  intention: 'morar' | 'investir' | null
  imovel_interesse: string | null
  summary: string | null
  interaction_count: number
  created_at: string
}

// Lead sem mensagens — exibido na seção Contatos
export type LeadContact = Pick<
  LeadWithLastInteraction,
  'id' | 'name' | 'phone' | 'automation_paused' | 'assigned_to' | 'stage' | 'city' | 'intention' | 'imovel_interesse' | 'summary' | 'interaction_count' | 'created_at'
>
