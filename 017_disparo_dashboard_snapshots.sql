-- 017_disparo_dashboard_snapshots.sql
-- Snapshots para atribuir respostas e avanço de pipeline aos disparos.

CREATE TABLE IF NOT EXISTS disparo_lead_snapshots (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type              TEXT NOT NULL DEFAULT 'reactivation'
                               CHECK (campaign_type IN ('campaign', 'reactivation')),
  campaign_id                UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  dispatch_id                UUID REFERENCES dispatches(id) ON DELETE CASCADE,
  reactivation_campaign_id   UUID REFERENCES reactivation_campaigns(id) ON DELETE CASCADE,
  reactivation_dispatch_id   UUID REFERENCES reactivation_dispatches(id) ON DELETE CASCADE,
  lead_id                    UUID REFERENCES leads(id) ON DELETE CASCADE,
  phone                      TEXT NOT NULL,
  message_sent               TEXT,
  stage_at_impact            TEXT,
  stage_current              TEXT,
  impact_count_at_snapshot   INTEGER,
  impacted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at                    TIMESTAMPTZ,
  responded_at               TIMESTAMPTZ,
  response_interaction_id    UUID REFERENCES interactions(id) ON DELETE SET NULL,
  advanced_at                TIMESTAMPTZ,
  advanced_to_stage          TEXT,
  meeting_at                 TIMESTAMPTZ,
  became_client_at           TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (campaign_type = 'campaign' AND campaign_id IS NOT NULL AND dispatch_id IS NOT NULL)
    OR
    (campaign_type = 'reactivation' AND reactivation_campaign_id IS NOT NULL AND reactivation_dispatch_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disparo_snapshots_dispatch_unique
  ON disparo_lead_snapshots(dispatch_id)
  WHERE dispatch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_disparo_snapshots_reactivation_dispatch_unique
  ON disparo_lead_snapshots(reactivation_dispatch_id)
  WHERE reactivation_dispatch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disparo_snapshots_lead_impacted
  ON disparo_lead_snapshots(lead_id, impacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_disparo_snapshots_responded
  ON disparo_lead_snapshots(responded_at)
  WHERE responded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disparo_snapshots_advanced
  ON disparo_lead_snapshots(advanced_at)
  WHERE advanced_at IS NOT NULL;

ALTER TABLE disparo_lead_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disparo_lead_snapshots: autenticados leem" ON disparo_lead_snapshots;
CREATE POLICY "disparo_lead_snapshots: autenticados leem"
  ON disparo_lead_snapshots FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "disparo_lead_snapshots: apenas ADM insere" ON disparo_lead_snapshots;
CREATE POLICY "disparo_lead_snapshots: apenas ADM insere"
  ON disparo_lead_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (is_adm());

DROP POLICY IF EXISTS "disparo_lead_snapshots: apenas ADM atualiza" ON disparo_lead_snapshots;
CREATE POLICY "disparo_lead_snapshots: apenas ADM atualiza"
  ON disparo_lead_snapshots FOR UPDATE
  TO authenticated
  USING (is_adm())
  WITH CHECK (is_adm());

CREATE OR REPLACE FUNCTION disparo_is_meeting_stage(p_stage TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_stage IN ('reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente');
$$;

CREATE OR REPLACE FUNCTION disparo_is_advanced_from_cold(p_stage TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_stage IN ('lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente');
$$;

CREATE OR REPLACE FUNCTION disparo_sync_snapshot_from_lead_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  UPDATE disparo_lead_snapshots s
  SET
    stage_current = NEW.stage,
    advanced_at = CASE
      WHEN s.advanced_at IS NULL
        AND COALESCE(s.stage_at_impact, 'lead_frio') IN ('lead_frio', 'nao_respondeu')
        AND disparo_is_advanced_from_cold(NEW.stage)
        AND NEW.stage IS DISTINCT FROM s.stage_at_impact
      THEN now()
      ELSE s.advanced_at
    END,
    advanced_to_stage = CASE
      WHEN s.advanced_at IS NULL
        AND COALESCE(s.stage_at_impact, 'lead_frio') IN ('lead_frio', 'nao_respondeu')
        AND disparo_is_advanced_from_cold(NEW.stage)
        AND NEW.stage IS DISTINCT FROM s.stage_at_impact
      THEN NEW.stage
      ELSE s.advanced_to_stage
    END,
    meeting_at = CASE
      WHEN s.meeting_at IS NULL AND disparo_is_meeting_stage(NEW.stage)
      THEN now()
      ELSE s.meeting_at
    END,
    became_client_at = CASE
      WHEN s.became_client_at IS NULL AND NEW.stage = 'cliente'
      THEN now()
      ELSE s.became_client_at
    END,
    updated_at = now()
  WHERE s.lead_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lead_stage_disparo_snapshot ON leads;
CREATE TRIGGER on_lead_stage_disparo_snapshot
AFTER UPDATE OF stage ON leads
FOR EACH ROW
EXECUTE FUNCTION disparo_sync_snapshot_from_lead_stage();

CREATE OR REPLACE FUNCTION disparo_sync_snapshot_from_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE disparo_lead_snapshots s
    SET
      responded_at = NEW.created_at,
      response_interaction_id = NEW.id,
      updated_at = now()
    WHERE s.lead_id = NEW.lead_id
      AND s.responded_at IS NULL
      AND s.impacted_at <= NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_interaction_disparo_response ON interactions;
CREATE TRIGGER on_interaction_disparo_response
AFTER INSERT ON interactions
FOR EACH ROW
EXECUTE FUNCTION disparo_sync_snapshot_from_interaction();

CREATE OR REPLACE FUNCTION disparo_sync_snapshot_from_reactivation_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE disparo_lead_snapshots s
  SET
    sent_at = CASE WHEN NEW.status = 'sent' THEN COALESCE(NEW.sent_at, now()) ELSE s.sent_at END,
    message_sent = COALESCE(NEW.message_sent, s.message_sent),
    updated_at = now()
  WHERE s.reactivation_dispatch_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reactivation_dispatch_disparo_snapshot ON reactivation_dispatches;
CREATE TRIGGER on_reactivation_dispatch_disparo_snapshot
AFTER UPDATE OF status, sent_at, message_sent ON reactivation_dispatches
FOR EACH ROW
EXECUTE FUNCTION disparo_sync_snapshot_from_reactivation_dispatch();

CREATE OR REPLACE FUNCTION disparo_sync_snapshot_from_campaign_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE disparo_lead_snapshots s
  SET
    sent_at = CASE WHEN NEW.status = 'sent' THEN COALESCE(NEW.sent_at, now()) ELSE s.sent_at END,
    message_sent = COALESCE(NEW.message_sent, s.message_sent),
    updated_at = now()
  WHERE s.dispatch_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_campaign_dispatch_disparo_snapshot ON dispatches;
CREATE TRIGGER on_campaign_dispatch_disparo_snapshot
AFTER UPDATE OF status, sent_at, message_sent ON dispatches
FOR EACH ROW
EXECUTE FUNCTION disparo_sync_snapshot_from_campaign_dispatch();

-- Backfill historico aproximado para campanhas de reativacao existentes.
INSERT INTO disparo_lead_snapshots (
  campaign_type,
  reactivation_campaign_id,
  reactivation_dispatch_id,
  lead_id,
  phone,
  message_sent,
  stage_at_impact,
  stage_current,
  impact_count_at_snapshot,
  impacted_at,
  sent_at,
  responded_at,
  response_interaction_id,
  advanced_at,
  advanced_to_stage,
  meeting_at,
  became_client_at
)
SELECT
  'reactivation',
  rd.reactivation_campaign_id,
  rd.id,
  rd.lead_id,
  rd.phone,
  rd.message_sent,
  COALESCE(l.stage, 'lead_frio'),
  l.stage,
  l.reactivation_count,
  rd.created_at,
  rd.sent_at,
  first_response.created_at,
  first_response.id,
  CASE
    WHEN COALESCE(l.stage, 'lead_frio') IN ('lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente')
    THEN COALESCE(first_response.created_at, rd.sent_at, rd.created_at)
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(l.stage, 'lead_frio') IN ('lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente')
    THEN l.stage
    ELSE NULL
  END,
  CASE
    WHEN disparo_is_meeting_stage(l.stage) THEN COALESCE(first_response.created_at, rd.sent_at, rd.created_at)
    ELSE NULL
  END,
  CASE
    WHEN l.stage = 'cliente' THEN COALESCE(first_response.created_at, rd.sent_at, rd.created_at)
    ELSE NULL
  END
FROM reactivation_dispatches rd
LEFT JOIN leads l ON l.id = rd.lead_id
LEFT JOIN LATERAL (
  SELECT i.id, i.created_at
  FROM interactions i
  WHERE i.lead_id = rd.lead_id
    AND i.direction = 'inbound'
    AND i.created_at >= rd.created_at
  ORDER BY i.created_at ASC
  LIMIT 1
) first_response ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM disparo_lead_snapshots s
  WHERE s.reactivation_dispatch_id = rd.id
);

-- Backfill historico aproximado para campanhas tradicionais, vinculando por telefone quando possivel.
INSERT INTO disparo_lead_snapshots (
  campaign_type,
  campaign_id,
  dispatch_id,
  lead_id,
  phone,
  message_sent,
  stage_at_impact,
  stage_current,
  impact_count_at_snapshot,
  impacted_at,
  sent_at,
  responded_at,
  response_interaction_id,
  advanced_at,
  advanced_to_stage,
  meeting_at,
  became_client_at
)
SELECT
  'campaign',
  d.campaign_id,
  d.id,
  l.id,
  d.phone,
  d.message_sent,
  COALESCE(l.stage, 'lead_frio'),
  l.stage,
  l.reactivation_count,
  d.created_at,
  d.sent_at,
  first_response.created_at,
  first_response.id,
  CASE
    WHEN COALESCE(l.stage, 'lead_frio') IN ('lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente')
    THEN COALESCE(first_response.created_at, d.sent_at, d.created_at)
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(l.stage, 'lead_frio') IN ('lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'sem_interesse', 'visita_confirmada', 'cliente')
    THEN l.stage
    ELSE NULL
  END,
  CASE
    WHEN disparo_is_meeting_stage(l.stage) THEN COALESCE(first_response.created_at, d.sent_at, d.created_at)
    ELSE NULL
  END,
  CASE
    WHEN l.stage = 'cliente' THEN COALESCE(first_response.created_at, d.sent_at, d.created_at)
    ELSE NULL
  END
FROM dispatches d
LEFT JOIN LATERAL (
  SELECT l.*
  FROM leads l
  WHERE regexp_replace(replace(l.phone, '@s.whatsapp.net', ''), '\D', '', 'g')
    = regexp_replace(replace(d.phone, '@s.whatsapp.net', ''), '\D', '', 'g')
  ORDER BY l.updated_at DESC
  LIMIT 1
) l ON true
LEFT JOIN LATERAL (
  SELECT i.id, i.created_at
  FROM interactions i
  WHERE i.lead_id = l.id
    AND i.direction = 'inbound'
    AND i.created_at >= d.created_at
  ORDER BY i.created_at ASC
  LIMIT 1
) first_response ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM disparo_lead_snapshots s
  WHERE s.dispatch_id = d.id
);
