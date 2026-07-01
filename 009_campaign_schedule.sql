-- Campaign allowed hours: envio só ocorre dentro da janela configurada
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS allowed_hours_start SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_hours_end   SMALLINT NOT NULL DEFAULT 23;

ALTER TABLE reactivation_campaigns
  ADD COLUMN IF NOT EXISTS allowed_hours_start SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_hours_end   SMALLINT NOT NULL DEFAULT 23;
