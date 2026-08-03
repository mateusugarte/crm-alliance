-- 018_lead_name_normalization.sql
-- Padroniza nomes de leads para reduzir emojis, apelidos longos e lixo de contato.

CREATE TABLE IF NOT EXISTS lead_name_normalization_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  old_name    TEXT,
  new_name    TEXT NOT NULL,
  changed_by  TEXT NOT NULL DEFAULT 'migration_018',
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_name_normalization_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_name_normalization_audit: apenas ADM le" ON lead_name_normalization_audit;
CREATE POLICY "lead_name_normalization_audit: apenas ADM le"
  ON lead_name_normalization_audit FOR SELECT
  TO authenticated
  USING (is_adm());

CREATE OR REPLACE FUNCTION normalize_lead_person_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT := COALESCE(p_name, '');
  token TEXT;
  lower_token TEXT;
  tokens TEXT[] := ARRAY[]::TEXT[];
  significant TEXT[] := ARRAY[]::TEXT[];
  chosen TEXT;
  generic_tokens CONSTANT TEXT[] := ARRAY[
    'lead',
    'cliente',
    'contato',
    'whatsapp',
    'zap',
    'novo',
    'nova',
    'sem',
    'nome',
    'desconhecido',
    'desconhecida',
    'dr',
    'dra',
    'sr',
    'sra',
    'vip',
    'crm',
    'null',
    'undefined',
    'none'
  ];
  particles CONSTANT TEXT[] := ARRAY['de', 'da', 'do', 'das', 'dos', 'e'];
BEGIN
  cleaned := regexp_replace(cleaned, '\[[^]]*\]|\([^)]*\)|\{[^}]*\}', ' ', 'g');
  cleaned := regexp_replace(cleaned, '@s\.whatsapp\.net', ' ', 'gi');
  cleaned := regexp_replace(cleaned, 'https?://[^[:space:]]+|www\.[^[:space:]]+', ' ', 'gi');
  cleaned := regexp_replace(cleaned, '[^[:alpha:]'' -]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '[[:space:]]+', ' ', 'g');

  FOR token IN
    SELECT (regexp_matches(cleaned, '[[:alpha:]][[:alpha:]''-]*', 'g'))[1]
  LOOP
    token := trim(both '-' from token);
    lower_token := lower(token);

    IF token = '' OR lower_token = ANY(generic_tokens) THEN
      CONTINUE;
    END IF;

    tokens := array_append(tokens, token);

    IF NOT lower_token = ANY(particles) THEN
      significant := array_append(significant, token);
    END IF;
  END LOOP;

  IF array_length(significant, 1) >= 2 THEN
    chosen := significant[1] || ' ' || significant[array_length(significant, 1)];
  ELSIF array_length(significant, 1) = 1 THEN
    chosen := significant[1];
  ELSIF array_length(tokens, 1) >= 2 THEN
    chosen := tokens[1] || ' ' || tokens[array_length(tokens, 1)];
  ELSIF array_length(tokens, 1) = 1 THEN
    chosen := tokens[1];
  ELSE
    chosen := 'Lead';
  END IF;

  RETURN COALESCE(NULLIF(initcap(lower(chosen)), ''), 'Lead');
END;
$$;

CREATE OR REPLACE FUNCTION normalize_lead_name_before_save()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := normalize_lead_person_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_normalize_name ON leads;
CREATE TRIGGER leads_normalize_name
BEFORE INSERT OR UPDATE OF name ON leads
FOR EACH ROW
EXECUTE FUNCTION normalize_lead_name_before_save();

ALTER TABLE leads DISABLE TRIGGER leads_updated_at;

WITH normalized AS (
  SELECT
    id,
    name AS old_name,
    normalize_lead_person_name(name) AS new_name
  FROM leads
),
changed AS (
  SELECT *
  FROM normalized
  WHERE old_name IS DISTINCT FROM new_name
)
INSERT INTO lead_name_normalization_audit (lead_id, old_name, new_name)
SELECT id, old_name, new_name
FROM changed;

WITH normalized AS (
  SELECT
    id,
    normalize_lead_person_name(name) AS new_name
  FROM leads
)
UPDATE leads l
SET name = n.new_name
FROM normalized n
WHERE l.id = n.id
  AND l.name IS DISTINCT FROM n.new_name;

ALTER TABLE leads ENABLE TRIGGER leads_updated_at;
