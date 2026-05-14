-- Migration 007: Módulo Reativar Contatos
-- Executar no Supabase SQL Editor

-- 1. Colunas de rastreamento na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reactivation_count integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reactivated_at timestamptz;

-- 2. Tabela de campanhas de reativação
CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  instance_id        text NOT NULL,
  reference_messages text[] NOT NULL,
  interval_min       integer NOT NULL,
  interval_max       integer NOT NULL,
  status             text NOT NULL DEFAULT 'draft',
  total_leads        integer NOT NULL DEFAULT 0,
  sent_count         integer NOT NULL DEFAULT 0,
  failed_count       integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabela de dispatches de reativação
CREATE TABLE IF NOT EXISTS reactivation_dispatches (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reactivation_campaign_id  uuid NOT NULL REFERENCES reactivation_campaigns(id) ON DELETE CASCADE,
  lead_id                   uuid REFERENCES leads(id),
  phone                     text NOT NULL,
  status                    text NOT NULL DEFAULT 'pending',
  message_sent              text,
  typing_delay              integer,
  interval_delay_ms         integer,
  sent_at                   timestamptz,
  error                     text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca de próximo dispatch pendente (ORDER BY created_at)
CREATE INDEX IF NOT EXISTS idx_reactivation_dispatches_campaign_status
  ON reactivation_dispatches(reactivation_campaign_id, status, created_at);

-- 4. RPCs para incremento atômico
CREATE OR REPLACE FUNCTION increment_reactivation_sent(p_campaign_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE reactivation_campaigns
  SET sent_count = sent_count + 1
  WHERE id = p_campaign_id;
$$;

CREATE OR REPLACE FUNCTION increment_reactivation_failed(p_campaign_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE reactivation_campaigns
  SET failed_count = failed_count + 1
  WHERE id = p_campaign_id;
$$;
