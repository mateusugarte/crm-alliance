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
          content: string
          wa_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          direction: 'inbound' | 'outbound'
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
          datetime: string
          notes: string | null
          status: 'scheduled' | 'completed' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          assigned_to?: string | null
          datetime: string
          notes?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>
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
          pavimento?: number
          numero_unidade?: number
          cobertura?: boolean
        }
        Update: Partial<Database['public']['Tables']['imoveis']['Insert']>
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
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Tipos de conveniência
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Interaction = Database['public']['Tables']['interactions']['Row']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type Broadcast = Database['public']['Tables']['broadcasts']['Row']
export type BroadcastNumber = Database['public']['Tables']['broadcast_numbers']['Row']
export type Imovel = Database['public']['Tables']['imoveis']['Row']
export type Label = Database['public']['Tables']['labels']['Row']
export type LeadLabel = Database['public']['Tables']['lead_labels']['Row']
