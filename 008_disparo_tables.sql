-- Migration 008: Tabelas do sistema de disparos
-- Executar no Supabase SQL Editor

-- 1. Instâncias WhatsApp
CREATE TABLE IF NOT EXISTS wa_instances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  instance_id  text NOT NULL UNIQUE,
  status       text NOT NULL DEFAULT 'disconnected',
  phone        text,
  connected_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Templates de mensagem
CREATE TABLE IF NOT EXISTS templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  content    text NOT NULL,
  media_url  text,
  media_type text DEFAULT 'image',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Campanhas de disparo
CREATE TABLE IF NOT EXISTS campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  template_id  uuid REFERENCES templates(id),
  template_ids uuid[] DEFAULT '{}',
  instance_id  text NOT NULL,
  status       text NOT NULL DEFAULT 'draft',
  total_leads  integer NOT NULL DEFAULT 0,
  sent_count   integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  interval_min integer NOT NULL DEFAULT 2,
  interval_max integer NOT NULL DEFAULT 5,
  media_url    text,
  media_type   text DEFAULT 'image',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. Dispatches de campanha
CREATE TABLE IF NOT EXISTS dispatches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  message_sent text,
  typing_delay integer,
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_campaign_status
  ON dispatches(campaign_id, status, created_at);

-- 5. Contatos para prospecção
CREATE TABLE IF NOT EXISTS contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL,
  name       text,
  niche      text NOT NULL DEFAULT 'manual',
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phone, niche)
);

CREATE INDEX IF NOT EXISTS idx_contacts_niche_sent
  ON contacts(niche, sent_count);

-- 6. Campanhas de reativação
CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  instance_id        text NOT NULL,
  reference_messages text[] NOT NULL DEFAULT '{}',
  interval_min       integer NOT NULL DEFAULT 2,
  interval_max       integer NOT NULL DEFAULT 5,
  status             text NOT NULL DEFAULT 'draft',
  total_leads        integer NOT NULL DEFAULT 0,
  sent_count         integer NOT NULL DEFAULT 0,
  failed_count       integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 7. Dispatches de reativação
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

CREATE INDEX IF NOT EXISTS idx_reactivation_dispatches_campaign_status
  ON reactivation_dispatches(reactivation_campaign_id, status, created_at);

-- 8. Colunas de reativação na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reactivation_count  integer NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reactivated_at timestamptz;

-- 9. RPCs para incremento atômico
CREATE OR REPLACE FUNCTION increment_campaign_sent(p_campaign_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = p_campaign_id;
$$;

CREATE OR REPLACE FUNCTION increment_campaign_failed(p_campaign_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = p_campaign_id;
$$;
