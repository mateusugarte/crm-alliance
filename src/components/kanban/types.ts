import type { IconComponent } from '@/lib/icons'
import { STAGES, type StageKey, type StageTokens } from '@/lib/stages'
import type { Lead } from '@/lib/supabase/types'

export type KanbanStage = Exclude<StageKey, 'cliente'>

export interface KanbanColumnConfig extends StageTokens {
  id: KanbanStage
  label: string
  icon: IconComponent
}

/** Ordem das colunas do quadro. Cor, rótulo e ícone vêm de `@/lib/stages`. */
const COLUMN_ORDER: KanbanStage[] = [
  'nao_respondeu',
  'lead_frio',
  'lead_morno',
  'lead_quente',
  'reuniao_agendada',
  'follow_up',
  'sem_interesse',
  'visita_confirmada',
]

export const KANBAN_COLUMNS: KanbanColumnConfig[] = COLUMN_ORDER.map((id) => {
  const { label, icon, solid, soft, ink } = STAGES[id]
  return { id, label, icon, solid, soft, ink }
})

export interface Label {
  id: string
  name: string
  color: string
}

export interface Interaction {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'lead' | 'bot' | 'corretor'
  sender_name: string | null
  content: string
  wa_message_id: string | null
  created_at: string
}

export interface LeadFull extends Lead {
  labels?: Label[]
}
