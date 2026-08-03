-- 019_lead_temperature_reclassification_audit.sql
-- Auditoria de realocacoes operacionais de temperatura do lead.

CREATE TABLE IF NOT EXISTS lead_temperature_reclassification_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_stage     TEXT NOT NULL,
  new_stage     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  signal        TEXT,
  source        TEXT NOT NULL DEFAULT 'manual_audit',
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_temperature_audit_lead
  ON lead_temperature_reclassification_audit(lead_id, changed_at DESC);

ALTER TABLE lead_temperature_reclassification_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_temperature_reclassification_audit: apenas ADM le" ON lead_temperature_reclassification_audit;
CREATE POLICY "lead_temperature_reclassification_audit: apenas ADM le"
  ON lead_temperature_reclassification_audit FOR SELECT
  TO authenticated
  USING (is_adm());
