export type KanbanStage =
  | 'lead_frio'
  | 'lead_morno'
  | 'lead_quente'
  | 'follow_up'
  | 'reuniao_agendada'
  | 'visita_confirmada'

export interface KanbanColumnConfig {
  id: KanbanStage
  label: string
  color: string
  icon: string
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: 'lead_frio',         label: 'Lead Frio',         color: '#1E90FF', icon: '❄️' },
  { id: 'lead_morno',        label: 'Lead Morno',        color: '#FF8C00', icon: '🔥' },
  { id: 'lead_quente',       label: 'Lead Quente',       color: '#FF4500', icon: '🚀' },
  { id: 'reuniao_agendada',  label: 'Reunião Agendada',  color: '#228B22', icon: '📅' },
  { id: 'follow_up',         label: 'Follow Up',         color: '#9B59B6', icon: '📱' },
  { id: 'visita_confirmada', label: 'Visita Confirmada', color: '#E67E22', icon: '🏠' },
]
