export interface LeadWithLastInteraction {
  id: string
  name: string
  phone: string
  automation_paused: boolean
  assigned_to: string | null
  lastMessage: string | null
  lastMessageAt: string | null
}

// Lead sem mensagens — exibido na seção Contatos
export type LeadContact = Pick<LeadWithLastInteraction, 'id' | 'name' | 'phone' | 'automation_paused' | 'assigned_to'>
