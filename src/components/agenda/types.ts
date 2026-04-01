export interface MeetingWithLead {
  id: string
  datetime: string
  notes: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  lead_id: string
  lead_name: string
  lead_phone: string
  assigned_to: string | null
  consultant_name: string
  consultant_color: string
}
