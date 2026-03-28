export interface LeadWithLastInteraction {
  id: string
  name: string
  phone: string
  automation_paused: boolean
  assigned_to: string | null
  lastMessage: string
  lastMessageAt: string
}
