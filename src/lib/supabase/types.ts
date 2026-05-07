export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  // Required by @supabase/supabase-js v2.100+
  PostgrestVersion: '12'
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          full_name: string
          role: 'adm' | 'corretor'
          badge_color: string
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'adm' | 'corretor'
          badge_color?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      leads: {
        Row: {
          id: string
          name: string
          phone: string
          wa_contact_id: string | null
          city: string | null
          stage:
            | 'nao_respondeu'
            | 'lead_frio'
            | 'lead_morno'
            | 'lead_quente'
            | 'follow_up'
            | 'reuniao_agendada'
            | 'visita_confirmada'
            | 'cliente'
          assigned_to: string | null
          automation_paused: boolean
          intention: 'morar' | 'investir' | null
          imovel_interesse: string | null
          summary: string | null
          interaction_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          wa_contact_id?: string | null
          city?: string | null
          stage?:
            | 'nao_respondeu'
            | 'lead_frio'
            | 'lead_morno'
            | 'lead_quente'
            | 'follow_up'
            | 'reuniao_agendada'
            | 'visita_confirmada'
            | 'cliente'
          assigned_to?: string | null
          automation_paused?: boolean
          intention?: 'morar' | 'investir' | null
          imovel_interesse?: string | null
          summary?: string | null
          interaction_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
      }
      interactions: {
        Row: {
          id: string
          lead_id: string
          direction: 'inbound' | 'outbound'
          sender_type: 'lead' | 'bot' | 'corretor'
          sender_name: string | null
          content: string
          wa_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          direction: 'inbound' | 'outbound'
          sender_type?: 'lead' | 'bot' | 'corretor'
          sender_name?: string | null
          content: string
          wa_message_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['interactions']['Insert']>
      }
      meetings: {
        Row: {
          id: string
          lead_id: string
          assigned_to: string | null
          title: string | null
          datetime: string
          notes: string | null
          status: 'scheduled' | 'completed' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          assigned_to?: string | null
          title?: string | null
          datetime: string
          notes?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>
      }
      lead_read_state: {
        Row: {
          lead_id: string
          user_id: string
          last_read_at: string
        }
        Insert: {
          lead_id: string
          user_id: string
          last_read_at?: string
        }
        Update: Partial<Database['public']['Tables']['lead_read_state']['Insert']>
      }
      broadcasts: {
        Row: {
          id: string
          created_by: string | null
          template_name: string
          template_params: Json | null
          message_preview: string | null
          status: 'draft' | 'running' | 'completed' | 'cancelled'
          total: number
          sent: number
          failed: number
          created_at: string
        }
        Insert: {
          id?: string
          created_by?: string | null
          template_name: string
          template_params?: Json | null
          message_preview?: string | null
          status?: 'draft' | 'running' | 'completed' | 'cancelled'
          total?: number
          sent?: number
          failed?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['broadcasts']['Insert']>
      }
      broadcast_numbers: {
        Row: {
          id: string
          broadcast_id: string
          phone: string
          wa_message_id: string | null
          status: 'pending' | 'sent' | 'failed'
          error_message: string | null
          sent_at: string | null
        }
        Insert: {
          id?: string
          broadcast_id: string
          phone: string
          wa_message_id?: string | null
          status?: 'pending' | 'sent' | 'failed'
          error_message?: string | null
          sent_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['broadcast_numbers']['Insert']>
      }
      imoveis: {
        Row: {
          id: string
          nome: string
          metragem: number
          quartos: number
          suites: number
          diferenciais: string[]
          valor_min: number | null
          valor_max: number | null
          disponivel: boolean
          vendido: boolean
          pavimento: number
          numero_unidade: number
          cobertura: boolean
        }
        Insert: {
          id: string
          nome: string
          metragem: number
          quartos: number
          suites: number
          diferenciais?: string[]
          valor_min?: number | null
          valor_max?: number | null
          disponivel?: boolean
          vendido?: boolean
          pavimento?: number
          numero_unidade?: number
          cobertura?: boolean
        }
        Update: Partial<Database['public']['Tables']['imoveis']['Insert']>
      }
      vendas: {
        Row: {
          id: string
          imovel_id: string
          comprador_nome: string
          comprador_telefone: string
          comprador_email: string | null
          unidade_comprada: string
          tem_entrada: boolean
          valor_entrada: number | null
          tem_financiamento: boolean
          valor_financiado: number | null
          parcelas_financiamento: number | null
          tem_parcelamento_direto: boolean
          parcelas_direto: number | null
          valor_parcela_direto: number | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          imovel_id: string
          comprador_nome: string
          comprador_telefone: string
          comprador_email?: string | null
          unidade_comprada: string
          tem_entrada?: boolean
          valor_entrada?: number | null
          tem_financiamento?: boolean
          valor_financiado?: number | null
          parcelas_financiamento?: number | null
          tem_parcelamento_direto?: boolean
          parcelas_direto?: number | null
          valor_parcela_direto?: number | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['vendas']['Insert']>
      }
      labels: {
        Row: {
          id: string
          name: string
          color: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['labels']['Insert']>
      }
      lead_labels: {
        Row: {
          lead_id: string
          label_id: string
          created_at: string
        }
        Insert: {
          lead_id: string
          label_id: string
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_interaction_count: {
        Args: { lead_uuid: string }
        Returns: undefined
      }
      toggle_automation_pause: {
        Args: { lead_uuid: string }
        Returns: boolean
      }
      move_lead_stage: {
        Args: { lead_uuid: string; new_stage: string }
        Returns: undefined
      }
      toggle_imovel_disponivel: {
        Args: { imovel_uuid: string }
        Returns: boolean
      }
      mark_lead_read: {
        Args: { lead_uuid: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}

// Tipos de conveniência
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Interaction = Database['public']['Tables']['interactions']['Row']
export type SenderType = Interaction['sender_type']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type Broadcast = Database['public']['Tables']['broadcasts']['Row']
export type BroadcastNumber = Database['public']['Tables']['broadcast_numbers']['Row']
export type Imovel = Database['public']['Tables']['imoveis']['Row']
export type Label = Database['public']['Tables']['labels']['Row']
export type LeadLabel = Database['public']['Tables']['lead_labels']['Row']
export type LeadReadState = Database['public']['Tables']['lead_read_state']['Row']
export type Venda = Database['public']['Tables']['vendas']['Row']
