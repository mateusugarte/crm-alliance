-- ============================================================
-- CRM Alliance — Migration 004
-- Garante que interactions existe com RLS + índices corretos
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Cria a tabela se não existir (idempotente)
CREATE TABLE IF NOT EXISTS interactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction      text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content        text NOT NULL,
  wa_message_id  text,          -- ID da mensagem no WhatsApp (para deduplicação)
  created_at     timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_interactions_lead    ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(lead_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_interactions_wa_msg  ON interactions(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- Habilita RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Policies (DROP antes para evitar conflito se já existirem)
DROP POLICY IF EXISTS "interactions: autenticados leem tudo" ON interactions;
DROP POLICY IF EXISTS "interactions: autenticados inserem"    ON interactions;

CREATE POLICY "interactions: autenticados leem tudo"
  ON interactions FOR SELECT
  TO authenticated
  USING (true);

-- Qualquer autenticado insere (corretor envio manual, webhook n8n usa service_role)
CREATE POLICY "interactions: autenticados inserem"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Nenhuma policy de UPDATE/DELETE = histórico imutável
-- (service_role do n8n bypassa RLS e consegue inserir normalmente)

-- ============================================================
-- VERIFICAÇÃO (opcional — rode para confirmar)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'interactions' ORDER BY ordinal_position;
