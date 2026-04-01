-- ============================================================
-- CRM Alliance — Migration 005
-- Adiciona sender_type e sender_name à tabela interactions
-- Permite distinguir: lead | bot (IA) | corretor (humano)
-- Execute no Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Adiciona a coluna como nullable primeiro (para poder atualizar dados existentes)
ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS sender_type text,
  ADD COLUMN IF NOT EXISTS sender_name text;  -- nome denormalizado: "IA Alliance", "Lucas", etc.

-- 2. Preenche registros existentes com base no direction
--    inbound  → quem enviou foi o lead
--    outbound → quem enviou foi o bot (padrão seguro para histórico antigo)
UPDATE interactions
SET sender_type = CASE
  WHEN direction = 'inbound' THEN 'lead'
  ELSE 'bot'
END
WHERE sender_type IS NULL;

-- 3. Aplica NOT NULL + CHECK constraint
ALTER TABLE interactions
  ALTER COLUMN sender_type SET NOT NULL,
  ALTER COLUMN sender_type SET DEFAULT 'lead';

-- Remove constraint anterior se existir (idempotente)
ALTER TABLE interactions
  DROP CONSTRAINT IF EXISTS interactions_sender_type_check;

ALTER TABLE interactions
  ADD CONSTRAINT interactions_sender_type_check
    CHECK (sender_type IN ('lead', 'bot', 'corretor'));

-- 4. Índice para filtrar por tipo de remetente
CREATE INDEX IF NOT EXISTS idx_interactions_sender ON interactions(lead_id, sender_type);

-- ============================================================
-- RESUMO DO MODELO:
--
--   sender_type = 'lead'     → mensagem enviada pelo lead (inbound)
--                               sender_name = NULL (usa nome do lead)
--
--   sender_type = 'bot'      → resposta gerada pela IA / N8N (outbound)
--                               sender_name = 'IA Alliance' (ou nome do agente)
--
--   sender_type = 'corretor' → mensagem manual enviada por um corretor (outbound)
--                               sender_name = full_name do corretor (ex: "Lucas")
--                               sender_id   = id do user_profiles (opcional, armazenado via app)
--
-- O N8N deve enviar:
--   { "interaction": { "direction": "inbound",  "sender_type": "lead",  "content": "..." } }
--   { "interaction": { "direction": "outbound", "sender_type": "bot",   "content": "...", "sender_name": "IA Alliance" } }
-- ============================================================

-- VERIFICAÇÃO (rode para confirmar)
-- SELECT id, direction, sender_type, sender_name, LEFT(content,40) FROM interactions LIMIT 20;
