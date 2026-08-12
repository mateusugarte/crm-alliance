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
      feriados: {
        Row: { data: string; descricao: string }
        Insert: { data: string; descricao: string }
        Update: { data?: string; descricao?: string }
      }
      configuracoes_sistema: {
        Row: { chave: string; valor: Json; atualizado_em: string; atualizado_por: string | null }
        Insert: { chave: string; valor: Json; atualizado_em?: string; atualizado_por?: string | null }
        Update: Partial<Database['public']['Tables']['configuracoes_sistema']['Insert']>
      }
      lead_stage_events: {
        Row: {
          id: string
          lead_id: string
          from_stage: string | null
          to_stage: string
          changed_at: string
          changed_by: string
          origem: string
        }
        Insert: {
          id?: string
          lead_id: string
          from_stage?: string | null
          to_stage: string
          changed_at?: string
          changed_by: string
          origem?: string
        }
        Update: Partial<Database['public']['Tables']['lead_stage_events']['Insert']>
      }
      tarefas: {
        Row: {
          id: string
          lead_id: string
          responsavel_id: string
          tipo: 'ligacao' | 'followup' | 'whatsapp' | 'visita'
          origem: 'qualificacao' | 'resgate' | 'retorno_agendado' | 'retentativa' | 'acompanhamento' | 'manual'
          tentativa_num: number
          criada_em: string
          vence_em: string
          concluida_em: string | null
          status: 'pendente' | 'feita' | 'vencida' | 'cancelada'
          escalonada_em: string | null
          briefing: Json | null
          observacao: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          responsavel_id: string
          tipo?: 'ligacao' | 'followup' | 'whatsapp' | 'visita'
          origem: 'qualificacao' | 'resgate' | 'retorno_agendado' | 'retentativa' | 'acompanhamento' | 'manual'
          tentativa_num?: number
          criada_em?: string
          vence_em: string
          concluida_em?: string | null
          status?: 'pendente' | 'feita' | 'vencida' | 'cancelada'
          escalonada_em?: string | null
          briefing?: Json | null
          observacao?: string | null
        }
        Update: Partial<Database['public']['Tables']['tarefas']['Insert']>
      }
      ligacoes: {
        Row: {
          id: string
          lead_id: string
          tarefa_id: string | null
          responsavel_id: string
          registrada_em: string
          desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse'
          retorno_em: string | null
          observacao: string | null
          marcou_reuniao: boolean
          reuniao_em: string | null
          excluida_em: string | null
          excluida_por: string | null
          estado_anterior: Json | null
          tarefa_gerada_id: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          tarefa_id?: string | null
          responsavel_id: string
          registrada_em?: string
          desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse'
          retorno_em?: string | null
          observacao?: string | null
          marcou_reuniao?: boolean
          reuniao_em?: string | null
          excluida_em?: string | null
          excluida_por?: string | null
          estado_anterior?: Json | null
          tarefa_gerada_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['ligacoes']['Insert']>
      }
      lead_activity_events: {
        Row: {
          id: string
          lead_id: string
          actor_id: string | null
          tipo: 'ligacao' | 'ligacao_desfeita' | 'reuniao_marcada' | 'retorno_agendado' | 'retentativa_agendada' | 'mudanca_estagio' | 'comentario' | 'sistema'
          titulo: string
          descricao: string | null
          metadata: Json
          referencia_tipo: string | null
          referencia_id: string | null
          criada_em: string
          desfeita_em: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          actor_id?: string | null
          tipo: 'ligacao' | 'ligacao_desfeita' | 'reuniao_marcada' | 'retorno_agendado' | 'retentativa_agendada' | 'mudanca_estagio' | 'comentario' | 'sistema'
          titulo: string
          descricao?: string | null
          metadata?: Json
          referencia_tipo?: string | null
          referencia_id?: string | null
          criada_em?: string
          desfeita_em?: string | null
        }
        Update: Partial<Database['public']['Tables']['lead_activity_events']['Insert']>
      }
      fila_diaria: {
        Row: {
          id: string
          data: string
          responsavel_id: string
          tarefa_id: string
          posicao: number
          faixa: 'alta' | 'media' | 'longo_prazo' | null
          gerada_em: string
        }
        Insert: {
          id?: string
          data: string
          responsavel_id: string
          tarefa_id: string
          posicao: number
          faixa?: 'alta' | 'media' | 'longo_prazo' | null
          gerada_em?: string
        }
        Update: Partial<Database['public']['Tables']['fila_diaria']['Insert']>
      }
      mensagens_saida: {
        Row: {
          id: string
          destino: string
          destino_tipo: 'usuario' | 'grupo'
          corpo: string
          contexto: Json
          criada_em: string
          enviada_em: string | null
          erro: string | null
          tentativas: number
          processando_em: string | null
          processando_por: string | null
          proxima_tentativa_em: string | null
          ultimo_erro_em: string | null
          provider_message_id: string | null
        }
        Insert: {
          id?: string
          destino: string
          destino_tipo: 'usuario' | 'grupo'
          corpo: string
          contexto?: Json
          criada_em?: string
          enviada_em?: string | null
          erro?: string | null
          tentativas?: number
          processando_em?: string | null
          processando_por?: string | null
          proxima_tentativa_em?: string | null
          ultimo_erro_em?: string | null
          provider_message_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['mensagens_saida']['Insert']>
      }
      login_logs: {
        Row: {
          id: string
          user_id: string
          email: string
          full_name: string | null
          role: 'adm' | 'corretor'
          source: string
          ip_address: string | null
          user_agent: string | null
          logged_at: string
          logged_date: string
          first_seen_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          full_name?: string | null
          role?: 'adm' | 'corretor'
          source?: string
          ip_address?: string | null
          user_agent?: string | null
          logged_at?: string
          logged_date?: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Update: Partial<Database['public']['Tables']['login_logs']['Insert']>
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
            | 'fornecedores'
            | 'lead_frio'
            | 'lead_morno'
            | 'lead_quente'
            | 'follow_up'
            | 'sem_interesse'
            | 'reuniao_agendada'
            | 'visita_confirmada'
            | 'cliente'
          assigned_to: string | null
          automation_paused: boolean
          intention: 'morar' | 'investir' | null
          imovel_interesse: string | null
          summary: string | null
          summary_comercial_curto: string | null
          summary_comercial_atualizado_em: string | null
          interaction_count: number
          antes_ia: boolean | null
          reactivation_count: number
          last_reactivated_at: string | null
          aceitou_consultor: boolean | null
          via_disparo: boolean | null
          pdf_enviado: boolean | null
          lead_score: number
          lead_score_band: 'muito_frio' | 'frio' | 'morno' | 'quente' | 'prioridade'
          lead_score_reasons: Json
          lead_score_updated_at: string | null
          qualificado_em: string | null
          prazo_primeiro_contato: string | null
          primeira_ligacao_em: string | null
          tentativas_ligacao: number
          ultimo_contato_em: string | null
          ultimo_desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse' | null
          score_resgate: number | null
          score_resgate_em: string | null
          resgate_status: 'elegivel' | 'na_fila' | 'trabalhado' | 'arquivado' | 'inelegivel'
          ultima_vez_na_fila: string | null
          motivo_perda: string | null
          dados_a_corrigir: boolean
          labels?: Array<{ id: string; name: string; color: string }>
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
            | 'fornecedores'
            | 'lead_frio'
            | 'lead_morno'
            | 'lead_quente'
            | 'follow_up'
            | 'sem_interesse'
            | 'reuniao_agendada'
            | 'visita_confirmada'
            | 'cliente'
          assigned_to?: string | null
          automation_paused?: boolean
          intention?: 'morar' | 'investir' | null
          imovel_interesse?: string | null
          summary?: string | null
          summary_comercial_curto?: string | null
          summary_comercial_atualizado_em?: string | null
          interaction_count?: number
          antes_ia?: boolean | null
          reactivation_count?: number
          last_reactivated_at?: string | null
          aceitou_consultor?: boolean | null
          via_disparo?: boolean | null
          pdf_enviado?: boolean | null
          lead_score?: number
          lead_score_band?: 'muito_frio' | 'frio' | 'morno' | 'quente' | 'prioridade'
          lead_score_reasons?: Json
          lead_score_updated_at?: string | null
          qualificado_em?: string | null
          prazo_primeiro_contato?: string | null
          primeira_ligacao_em?: string | null
          tentativas_ligacao?: number
          ultimo_contato_em?: string | null
          ultimo_desfecho?: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse' | null
          score_resgate?: number | null
          score_resgate_em?: string | null
          resgate_status?: 'elegivel' | 'na_fila' | 'trabalhado' | 'arquivado' | 'inelegivel'
          ultima_vez_na_fila?: string | null
          motivo_perda?: string | null
          dados_a_corrigir?: boolean
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
      lead_comments: {
        Row: {
          id: string
          lead_id: string
          user_id: string
          user_name: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id: string
          user_name: string
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['lead_comments']['Insert']>
      }
      wa_instances: {
        Row: {
          id: string
          name: string
          instance_id: string
          status: string
          phone: string | null
          connected_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          instance_id: string
          status?: string
          phone?: string | null
          connected_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['wa_instances']['Insert']>
      }
      templates: {
        Row: {
          id: string
          name: string
          content: string
          media_url: string | null
          media_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          content: string
          media_url?: string | null
          media_type?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['templates']['Insert']>
      }
      campaigns: {
        Row: {
          id: string
          name: string
          template_id: string | null
          template_ids: string[]
          instance_id: string
          status: string
          total_leads: number
          sent_count: number
          failed_count: number
          interval_min: number
          interval_max: number
          media_url: string | null
          media_type: string | null
          allowed_hours_start: number
          allowed_hours_end: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          template_id?: string | null
          template_ids?: string[]
          instance_id: string
          status?: string
          total_leads?: number
          sent_count?: number
          failed_count?: number
          interval_min?: number
          interval_max?: number
          media_url?: string | null
          media_type?: string | null
          allowed_hours_start?: number
          allowed_hours_end?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
      }
      dispatches: {
        Row: {
          id: string
          campaign_id: string
          phone: string
          status: string
          message_sent: string | null
          typing_delay: number | null
          scheduled_at: string | null
          sent_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          phone: string
          status?: string
          message_sent?: string | null
          typing_delay?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['dispatches']['Insert']>
      }
      reactivation_campaigns: {
        Row: {
          id: string
          name: string
          instance_id: string
          reference_messages: string[]
          interval_min: number
          interval_max: number
          status: string
          total_leads: number
          sent_count: number
          failed_count: number
          allowed_hours_start: number
          allowed_hours_end: number
          campaign_brief: Json | null
          generation_version: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          instance_id: string
          reference_messages: string[]
          interval_min: number
          interval_max: number
          status?: string
          total_leads?: number
          sent_count?: number
          failed_count?: number
          allowed_hours_start?: number
          allowed_hours_end?: number
          campaign_brief?: Json | null
          generation_version?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reactivation_campaigns']['Insert']>
      }
      reactivation_dispatches: {
        Row: {
          id: string
          reactivation_campaign_id: string
          lead_id: string | null
          phone: string
          status: string
          message_sent: string | null
          typing_delay: number | null
          interval_delay_ms: number | null
          scheduled_at: string | null
          sent_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reactivation_campaign_id: string
          lead_id?: string | null
          phone: string
          status?: string
          message_sent?: string | null
          typing_delay?: number | null
          interval_delay_ms?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reactivation_dispatches']['Insert']>
      }
      reactivation_generation_snapshots: {
        Row: {
          id: string
          reactivation_campaign_id: string
          reactivation_dispatch_id: string
          lead_id: string | null
          original_message: string
          approved_message: string
          campaign_brief: Json
          audience: Json
          context_facts: Json
          message_plan: Json
          context_mode: string
          context_summary: string
          model: string | null
          prompt_version: string
          resolution: string
          quality_flags: string[]
          manually_edited: boolean
          approved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reactivation_campaign_id: string
          reactivation_dispatch_id: string
          lead_id?: string | null
          original_message: string
          approved_message: string
          campaign_brief: Json
          audience: Json
          context_facts?: Json
          message_plan: Json
          context_mode: string
          context_summary: string
          model?: string | null
          prompt_version: string
          resolution: string
          quality_flags?: string[]
          manually_edited?: boolean
          approved_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reactivation_generation_snapshots']['Insert']>
      }
      disparo_lead_snapshots: {
        Row: {
          id: string
          campaign_type: 'campaign' | 'reactivation'
          campaign_id: string | null
          dispatch_id: string | null
          reactivation_campaign_id: string | null
          reactivation_dispatch_id: string | null
          lead_id: string | null
          phone: string
          message_sent: string | null
          stage_at_impact: string | null
          stage_current: string | null
          impact_count_at_snapshot: number | null
          impacted_at: string
          sent_at: string | null
          responded_at: string | null
          response_interaction_id: string | null
          advanced_at: string | null
          advanced_to_stage: string | null
          meeting_at: string | null
          became_client_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_type?: 'campaign' | 'reactivation'
          campaign_id?: string | null
          dispatch_id?: string | null
          reactivation_campaign_id?: string | null
          reactivation_dispatch_id?: string | null
          lead_id?: string | null
          phone: string
          message_sent?: string | null
          stage_at_impact?: string | null
          stage_current?: string | null
          impact_count_at_snapshot?: number | null
          impacted_at?: string
          sent_at?: string | null
          responded_at?: string | null
          response_interaction_id?: string | null
          advanced_at?: string | null
          advanced_to_stage?: string | null
          meeting_at?: string | null
          became_client_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['disparo_lead_snapshots']['Insert']>
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
      move_lead_stage_context: {
        Args: { lead_uuid: string; new_stage: string; p_motivo_perda?: string | null; p_origem?: string }
        Returns: undefined
      }
      inject_reactivation_message: {
        Args: {
          p_dispatch_id: string
          p_message: string
          p_typing_delay: number
          p_interval_delay_ms: number
          p_snapshot?: Json | null
          p_approved_by?: string | null
        }
        Returns: boolean
      }
      registrar_ligacao: {
        Args: {
          p_tarefa_id: string
          p_desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse'
          p_observacao?: string | null
          p_retorno_em?: string | null
          p_marcou_reuniao?: boolean
          p_reuniao_em?: string | null
          p_motivo_perda?: string | null
        }
        Returns: Database['public']['Tables']['ligacoes']['Row']
      }
      registrar_ligacao_v2: {
        Args: {
          p_tarefa_id: string
          p_desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse'
          p_observacao?: string | null
          p_retorno_em?: string | null
          p_marcou_reuniao?: boolean
          p_motivo_perda?: string | null
        }
        Returns: Json
      }
      registrar_ligacao_lead_v1: {
        Args: {
          p_lead_id: string
          p_desfecho: 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'numero_errado' | 'pediu_retorno' | 'sem_interesse'
          p_observacao?: string | null
          p_retorno_em?: string | null
          p_marcou_reuniao?: boolean
          p_motivo_perda?: string | null
        }
        Returns: Json
      }
      desfazer_ligacao: {
        Args: { p_ligacao_id: string }
        Returns: undefined
      }
      desfazer_ligacao_v2: {
        Args: { p_ligacao_id: string }
        Returns: Json
      }
      calcula_prazo: {
        Args: { p_qualificado_em: string }
        Returns: string
      }
      calculate_lead_score: {
        Args: { p_lead_id: string }
        Returns: {
          score: number
          score_10: number
          band: 'muito_frio' | 'frio' | 'morno' | 'quente' | 'prioridade'
          reasons: Json
        }[]
      }
      refresh_lead_score: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      list_user_access_overview: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          full_name: string | null
          role: 'adm' | 'corretor' | null
          badge_color: string | null
          created_at: string
          confirmed_at: string | null
          last_sign_in_at: string | null
          last_login_at: string | null
          login_count: number
          login_count_7d: number
          login_count_30d: number
        }[]
      }
      record_user_access_event: {
        Args: { p_ip_address?: string | null; p_user_agent?: string | null }
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
      central_ultimas_interacoes: {
        Args: { p_lead_ids: string[] }
        Returns: { lead_id: string; created_at: string }[]
      }
    }
    Enums: Record<string, never>
  }
}

// Tipos de conveniência
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type LoginLog = Database['public']['Tables']['login_logs']['Row']
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
export type WaInstance = Database['public']['Tables']['wa_instances']['Row']
export type Template = Database['public']['Tables']['templates']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type Dispatch = Database['public']['Tables']['dispatches']['Row']
export type ReactivationCampaign = Database['public']['Tables']['reactivation_campaigns']['Row']
export type ReactivationDispatch = Database['public']['Tables']['reactivation_dispatches']['Row']
export type DisparoLeadSnapshot = Database['public']['Tables']['disparo_lead_snapshots']['Row']
export type LeadComment = Database['public']['Tables']['lead_comments']['Row']
