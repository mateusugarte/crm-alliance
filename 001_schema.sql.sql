-- ============================================================
-- CRM Alliance — La Reserva
-- Migration 001: Schema completo + RLS
-- ============================================================
-- Executar no Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSÕES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

-- Perfis dos usuários do sistema (extensão do auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  role         text NOT NULL DEFAULT 'corretor'
                 CHECK (role IN ('adm', 'corretor')),
  badge_color  text NOT NULL DEFAULT '#0A2EAD', -- cor do badge deste consultor
  created_at   timestamptz DEFAULT now()
);

-- Leads captados via WhatsApp
CREATE TABLE IF NOT EXISTS leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  phone              text NOT NULL UNIQUE, -- E.164: +5528999999999
  wa_contact_id      text,
  city               text,                 -- cidade identificada pela IA
  stage              text NOT NULL DEFAULT 'lead_frio'
                       CHECK (stage IN (
                         'lead_frio','lead_morno','lead_quente',
                         'follow_up','reuniao_agendada','visita_confirmada','cliente'
                       )),
  assigned_to        uuid, -- FK para auth.users gerenciada pela aplicação (não via constraint)
  automation_paused  boolean DEFAULT false,
  intention          text CHECK (intention IN ('morar','investir') OR intention IS NULL),
  imovel_interesse   text, -- 'Apto_01' | 'Apto_02' | 'Apto_03' | 'Apto_04' | 'Cob_01' | 'Cob_02'
  summary            text, -- resumo atualizado pela IA após cada interação
  interaction_count  integer DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Histórico completo de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS interactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction      text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content        text NOT NULL,
  wa_message_id  text,
  created_at     timestamptz DEFAULT now()
);

-- Reuniões agendadas
CREATE TABLE IF NOT EXISTS meetings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to  uuid, -- FK para auth.users gerenciada pela aplicação
  datetime     timestamptz NOT NULL,
  notes        text,
  status       text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','completed','cancelled')),
  created_at   timestamptz DEFAULT now()
);

-- Campanhas de disparo em massa
CREATE TABLE IF NOT EXISTS broadcasts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid, -- FK para auth.users gerenciada pela aplicação
  template_name    text NOT NULL,
  template_params  jsonb,
  message_preview  text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','running','completed','cancelled')),
  total            integer DEFAULT 0,
  sent             integer DEFAULT 0,
  failed           integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- Números individuais de cada campanha
CREATE TABLE IF NOT EXISTS broadcast_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  wa_message_id text,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed')),
  error_message text,
  sent_at       timestamptz
);

-- Unidades do La Reserva (dados estáticos)
CREATE TABLE IF NOT EXISTS imoveis (
  id            text PRIMARY KEY,          -- 'Apto_01', 'Cob_01', etc.
  nome          text NOT NULL,
  metragem      numeric NOT NULL,
  quartos       integer NOT NULL,
  suites        integer NOT NULL,
  diferenciais  text[] DEFAULT '{}',
  valor_min     numeric,
  valor_max     numeric,
  disponivel    boolean DEFAULT true
);

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_stage       ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned    ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_phone       ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created     ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_dir  ON interactions(lead_id, direction);
CREATE INDEX IF NOT EXISTS idx_meetings_lead     ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_assigned ON meetings(assigned_to);
CREATE INDEX IF NOT EXISTS idx_meetings_datetime ON meetings(datetime);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_bcast_num_bcast   ON broadcast_numbers(broadcast_id);

-- ------------------------------------------------------------
-- TRIGGER — atualiza updated_at nos leads
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS — ESTRATÉGIA
-- ============================================================
-- O sistema tem dados compartilhados (todos veem todos os leads)
-- mas com controle de ação:
--   ADM    → pode fazer tudo em todas as tabelas
--   Corretor → pode ler tudo (todos os leads), mas só edita
--              leads que estão assigned_to = seu próprio id
--   Webhook/N8N → usa service_role (bypassa RLS, só server-side)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_numbers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis            ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: verifica se o usuário logado é ADM
CREATE OR REPLACE FUNCTION is_adm()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'adm'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- POLICIES: user_profiles
-- ------------------------------------------------------------
-- Qualquer usuário autenticado lê todos os perfis (precisa para mostrar badges)
CREATE POLICY "user_profiles: autenticados leem tudo"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Cada usuário edita apenas o próprio perfil; ADM edita qualquer um
CREATE POLICY "user_profiles: editar proprio ou ser ADM"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_adm())
  WITH CHECK (id = auth.uid() OR is_adm());

-- Apenas ADM insere perfis
CREATE POLICY "user_profiles: apenas ADM insere"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_adm());

-- ------------------------------------------------------------
-- POLICIES: leads
-- ------------------------------------------------------------
-- Todos os autenticados leem todos os leads (visão compartilhada do Kanban)
CREATE POLICY "leads: autenticados leem tudo"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: qualquer autenticado pode criar lead (corretor cria novo lead manual)
CREATE POLICY "leads: autenticados inserem"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: ADM edita qualquer lead; corretor só edita lead atribuído a ele
CREATE POLICY "leads: ADM edita tudo, corretor edita os seus"
  ON leads FOR UPDATE
  TO authenticated
  USING (is_adm() OR assigned_to = auth.uid())
  WITH CHECK (is_adm() OR assigned_to = auth.uid());

-- DELETE: apenas ADM pode deletar leads
CREATE POLICY "leads: apenas ADM deleta"
  ON leads FOR DELETE
  TO authenticated
  USING (is_adm());

-- ------------------------------------------------------------
-- POLICIES: interactions
-- ------------------------------------------------------------
-- Todos leem todas as interações (necessário para a tela de chat)
CREATE POLICY "interactions: autenticados leem tudo"
  ON interactions FOR SELECT
  TO authenticated
  USING (true);

-- Qualquer autenticado pode inserir interação (corretor envia mensagem manual)
CREATE POLICY "interactions: autenticados inserem"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ninguém edita ou deleta interações (imutabilidade do histórico)
-- (sem policies de UPDATE/DELETE = ninguém faz, exceto service_role)

-- ------------------------------------------------------------
-- POLICIES: meetings
-- ------------------------------------------------------------
-- Todos leem todas as reuniões (agenda compartilhada)
CREATE POLICY "meetings: autenticados leem tudo"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

-- Qualquer autenticado cria reunião
CREATE POLICY "meetings: autenticados inserem"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ADM edita qualquer reunião; corretor edita apenas as suas
CREATE POLICY "meetings: ADM edita tudo, corretor edita as suas"
  ON meetings FOR UPDATE
  TO authenticated
  USING (is_adm() OR assigned_to = auth.uid())
  WITH CHECK (is_adm() OR assigned_to = auth.uid());

-- Apenas ADM deleta reuniões
CREATE POLICY "meetings: apenas ADM deleta"
  ON meetings FOR DELETE
  TO authenticated
  USING (is_adm());

-- ------------------------------------------------------------
-- POLICIES: broadcasts
-- ------------------------------------------------------------
-- Todos leem o histórico de campanhas
CREATE POLICY "broadcasts: autenticados leem tudo"
  ON broadcasts FOR SELECT
  TO authenticated
  USING (true);

-- Apenas ADM cria, edita e deleta campanhas
CREATE POLICY "broadcasts: apenas ADM gerencia"
  ON broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (is_adm());

CREATE POLICY "broadcasts: apenas ADM edita"
  ON broadcasts FOR UPDATE
  TO authenticated
  USING (is_adm())
  WITH CHECK (is_adm());

CREATE POLICY "broadcasts: apenas ADM deleta"
  ON broadcasts FOR DELETE
  TO authenticated
  USING (is_adm());

-- ------------------------------------------------------------
-- POLICIES: broadcast_numbers
-- ------------------------------------------------------------
-- Todos leem (para ver progresso de campanha)
CREATE POLICY "broadcast_numbers: autenticados leem tudo"
  ON broadcast_numbers FOR SELECT
  TO authenticated
  USING (true);

-- Apenas ADM gerencia números de campanha
CREATE POLICY "broadcast_numbers: apenas ADM gerencia"
  ON broadcast_numbers FOR INSERT
  TO authenticated
  WITH CHECK (is_adm());

CREATE POLICY "broadcast_numbers: apenas ADM edita"
  ON broadcast_numbers FOR UPDATE
  TO authenticated
  USING (is_adm())
  WITH CHECK (is_adm());

-- ------------------------------------------------------------
-- POLICIES: imoveis
-- ------------------------------------------------------------
-- Todos leem os imóveis (página pública do sistema)
CREATE POLICY "imoveis: autenticados leem tudo"
  ON imoveis FOR SELECT
  TO authenticated
  USING (true);

-- Apenas ADM gerencia o catálogo
CREATE POLICY "imoveis: apenas ADM gerencia"
  ON imoveis FOR ALL
  TO authenticated
  USING (is_adm())
  WITH CHECK (is_adm());

-- ------------------------------------------------------------
-- SEED: Imóveis do La Reserva
-- ------------------------------------------------------------
INSERT INTO imoveis (id, nome, metragem, quartos, suites, diferenciais, valor_min, valor_max, disponivel)
VALUES
  ('Apto_01', 'Apartamento 01', 146.00, 3, 1, ARRAY['1 suíte','1 closet'],          894000, 930000, true),
  ('Apto_02', 'Apartamento 02',  90.80, 2, 1, ARRAY['1 suíte'],                     535000, 546000, true),
  ('Apto_03', 'Apartamento 03', 110.85, 3, 1, ARRAY['1 suíte'],                     653000, 692000, true),
  ('Apto_04', 'Apartamento 04', 144.80, 3, 1, ARRAY['1 suíte','1 closet'],          840000, 883000, true),
  ('Cob_01',  'Cobertura 01',  245.60, 4, 2, ARRAY['cobertura exclusiva','2 suítes com closet'], 1791000, 1791000, true),
  ('Cob_02',  'Cobertura 02',  259.95, 4, 2, ARRAY['cobertura exclusiva','2 suítes com closet'], 1692000, 1692000, true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- SEED: Criar user_profiles (executar APÓS criar usuários no Auth)
-- ------------------------------------------------------------
-- Substitua os emails pelos reais cadastrados no Supabase Auth Dashboard
-- Execute este bloco separadamente após criar os 5 usuários

/*
INSERT INTO user_profiles (id, full_name, role, badge_color)
VALUES
  ((SELECT id FROM auth.users WHERE email = 'lucas@alliance.com.br'),  'Lucas', 'corretor', '#0A2EAD'),
  ((SELECT id FROM auth.users WHERE email = 'joao@alliance.com.br'),   'João',  'corretor', '#FF6B00'),
  ((SELECT id FROM auth.users WHERE email = 'marco@alliance.com.br'),  'Marco', 'corretor', '#0A2EAD'),
  ((SELECT id FROM auth.users WHERE email = 'jaque@alliance.com.br'),  'Jaque', 'corretor', '#0A2EAD'),
  ((SELECT id FROM auth.users WHERE email = 'adm@alliance.com.br'),    'ADM',   'adm',      '#0A2EAD')
ON CONFLICT (id) DO NOTHING;
*/

-- ------------------------------------------------------------
-- VERIFICAÇÃO RÁPIDA (rodar após a migration para confirmar)
-- ------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
