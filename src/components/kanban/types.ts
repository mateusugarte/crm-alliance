import type { LucideIcon } from 'lucide-react'
import { Snowflake, Flame, Zap, CalendarCheck, RefreshCw, CheckCircle2, MessageCircleOff } from 'lucide-react'

export type KanbanStage =
  | 'nao_respondeu'
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
  icon: LucideIcon
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: 'nao_respondeu',     label: 'Não Respondeu',     color: '#6B7280', icon: MessageCircleOff },
  { id: 'lead_frio',         label: 'Lead Frio',         color: '#1E90FF', icon: Snowflake },
  { id: 'lead_morno',        label: 'Lead Morno',        color: '#FF8C00', icon: Flame },
  { id: 'lead_quente',       label: 'Lead Quente',       color: '#FF4500', icon: Zap },
  { id: 'reuniao_agendada',  label: 'Reunião Agendada',  color: '#228B22', icon: CalendarCheck },
  { id: 'follow_up',         label: 'Follow Up',         color: '#9B59B6', icon: RefreshCw },
  { id: 'visita_confirmada', label: 'Visita Confirmada', color: '#E67E22', icon: CheckCircle2 },
]
