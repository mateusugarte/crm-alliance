-- Central do Dia: foundation, audit trail and task data model.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE tarefa_tipo AS ENUM ('ligacao', 'followup', 'whatsapp', 'visita');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tarefa_origem AS ENUM ('qualificacao', 'resgate', 'retorno_agendado', 'retentativa', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tarefa_status AS ENUM ('pendente', 'feita', 'vencida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ligacao_desfecho AS ENUM (
    'atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado',
    'pediu_retorno', 'sem_interesse'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS feriados (
  data date PRIMARY KEY,
  descricao text NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES user_profiles(id)
);

INSERT INTO configuracoes_sistema (chave, valor)
VALUES (
  'central_do_dia',
  jsonb_build_object(
    'resgate_diario_padrao', 3,
    'responsavel_resgate_id', null,
    'grupo_whatsapp', '120363429109259182@g.us',
    'crm_base_url', 'https://crm.alliance.com.br'
  )
)
ON CONFLICT (chave) DO NOTHING;

-- National holidays and the local Corpus Christi holiday used by Castelo/ES.
-- The calendar remains editable through this table as new municipal decrees are published.
INSERT INTO feriados (data, descricao) VALUES
  ('2026-01-01', 'Confraternizacao Universal'),
  ('2026-04-03', 'Paixao de Cristo'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi - Castelo/ES'),
  ('2026-09-07', 'Independencia do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamacao da Republica'),
  ('2026-11-20', 'Consciencia Negra'),
  ('2026-12-25', 'Natal')
ON CONFLICT (data) DO UPDATE SET descricao = EXCLUDED.descricao;

CREATE TABLE IF NOT EXISTS lead_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL,
  origem text NOT NULL DEFAULT 'sistema'
);

CREATE TABLE IF NOT EXISTS lead_automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  paused boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_automation_events_period
  ON lead_automation_events (changed_at DESC, paused);

CREATE INDEX IF NOT EXISTS idx_lead_stage_events_lead
  ON lead_stage_events (lead_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_stage
  ON lead_stage_events (to_stage, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_period
  ON lead_stage_events (changed_at DESC) WHERE origem <> 'backfill';

CREATE TABLE IF NOT EXISTS tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  responsavel_id uuid NOT NULL REFERENCES user_profiles(id),
  tipo tarefa_tipo NOT NULL DEFAULT 'ligacao',
  origem tarefa_origem NOT NULL,
  tentativa_num integer NOT NULL DEFAULT 1 CHECK (tentativa_num > 0),
  criada_em timestamptz NOT NULL DEFAULT now(),
  vence_em timestamptz NOT NULL,
  concluida_em timestamptz,
  status tarefa_status NOT NULL DEFAULT 'pendente',
  escalonada_em timestamptz,
  briefing jsonb,
  observacao text
);

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_status
  ON tarefas (responsavel_id, status, vence_em);
CREATE INDEX IF NOT EXISTS idx_tarefas_lead_status
  ON tarefas (lead_id, status);
DROP INDEX IF EXISTS tarefas_lead_ativa_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS tarefas_lead_pendente_uniq
  ON tarefas (lead_id) WHERE status = 'pendente';

CREATE TABLE IF NOT EXISTS ligacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES tarefas(id),
  responsavel_id uuid NOT NULL REFERENCES user_profiles(id),
  registrada_em timestamptz NOT NULL DEFAULT now(),
  desfecho ligacao_desfecho NOT NULL,
  retorno_em timestamptz,
  observacao text,
  marcou_reuniao boolean NOT NULL DEFAULT false,
  reuniao_em timestamptz,
  excluida_em timestamptz,
  excluida_por uuid REFERENCES user_profiles(id),
  CONSTRAINT ligacoes_retorno_obrigatorio CHECK (
    desfecho <> 'pediu_retorno' OR retorno_em IS NOT NULL
  ),
  CONSTRAINT ligacoes_reuniao_data CHECK (
    marcou_reuniao = false OR reuniao_em IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_ligacoes_lead
  ON ligacoes (lead_id, registrada_em DESC) WHERE excluida_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_ligacoes_responsavel
  ON ligacoes (responsavel_id, registrada_em DESC) WHERE excluida_em IS NULL;

CREATE TABLE IF NOT EXISTS fila_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  responsavel_id uuid NOT NULL REFERENCES user_profiles(id),
  tarefa_id uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  posicao integer NOT NULL CHECK (posicao > 0),
  faixa text CHECK (faixa IN ('alta', 'media', 'longo_prazo') OR faixa IS NULL),
  gerada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data, responsavel_id, tarefa_id),
  UNIQUE (data, responsavel_id, posicao)
);

CREATE INDEX IF NOT EXISTS idx_fila_diaria_usuario
  ON fila_diaria (responsavel_id, data DESC, posicao);

CREATE TABLE IF NOT EXISTS mensagens_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino text NOT NULL,
  destino_tipo text NOT NULL CHECK (destino_tipo IN ('usuario', 'grupo')),
  corpo text NOT NULL,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  criada_em timestamptz NOT NULL DEFAULT now(),
  enviada_em timestamptz,
  erro text,
  tentativas integer NOT NULL DEFAULT 0,
  processando_em timestamptz,
  processando_por text
);

ALTER TABLE mensagens_saida
  ADD COLUMN IF NOT EXISTS processando_em timestamptz,
  ADD COLUMN IF NOT EXISTS processando_por text;

CREATE INDEX IF NOT EXISTS idx_mensagens_saida_pendentes
  ON mensagens_saida (criada_em) WHERE enviada_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_saida_idempotencia
  ON mensagens_saida ((contexto->>'idempotency_key'))
  WHERE contexto ? 'idempotency_key';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS qualificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_primeiro_contato timestamptz,
  ADD COLUMN IF NOT EXISTS primeira_ligacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS tentativas_ligacao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_desfecho ligacao_desfecho,
  ADD COLUMN IF NOT EXISTS score_resgate numeric,
  ADD COLUMN IF NOT EXISTS score_resgate_em timestamptz,
  ADD COLUMN IF NOT EXISTS resgate_status text NOT NULL DEFAULT 'elegivel',
  ADD COLUMN IF NOT EXISTS ultima_vez_na_fila date,
  ADD COLUMN IF NOT EXISTS motivo_perda text;

DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_resgate_status_check
    CHECK (resgate_status IN ('elegivel', 'na_fila', 'trabalhado', 'arquivado', 'inelegivel'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_resgate_pool
  ON leads (resgate_status, score_resgate DESC, ultima_vez_na_fila);
CREATE INDEX IF NOT EXISTS idx_leads_primeiro_contato
  ON leads (prazo_primeiro_contato)
  WHERE primeira_ligacao_em IS NULL AND prazo_primeiro_contato IS NOT NULL;

CREATE OR REPLACE FUNCTION calcula_prazo(p_qualificado_em timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_local timestamp := p_qualificado_em AT TIME ZONE 'America/Sao_Paulo' + interval '36 hours';
  v_date date;
  v_is_non_working boolean;
BEGIN
  LOOP
    v_date := v_local::date;
    v_is_non_working := extract(isodow FROM v_local) IN (6, 7)
      OR EXISTS (SELECT 1 FROM feriados f WHERE f.data = v_date);

    IF v_is_non_working THEN
      v_local := (v_date + interval '1 day')::timestamp + time '12:00';
      WHILE extract(isodow FROM v_local) IN (6, 7)
        OR EXISTS (SELECT 1 FROM feriados f WHERE f.data = v_local::date)
      LOOP
        v_local := (v_local::date + interval '1 day')::timestamp + time '12:00';
      END LOOP;
      EXIT;
    END IF;

    IF v_local::time < time '08:00' THEN
      v_local := v_date::timestamp + time '08:00';
      EXIT;
    ELSIF v_local::time > time '20:00' THEN
      v_local := (v_date + interval '1 day')::timestamp + time '08:00';
      CONTINUE;
    END IF;

    EXIT;
  END LOOP;

  RETURN v_local AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

CREATE OR REPLACE FUNCTION central_registra_evento_estagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user text;
  v_origem text;
BEGIN
  v_user := NULLIF(current_setting('app.user_id', true), '');
  IF v_user IS NULL THEN
    v_user := COALESCE(auth.uid()::text, 'motor_ia');
  END IF;

  v_origem := NULLIF(current_setting('app.origem', true), '');
  IF v_origem IS NULL THEN
    v_origem := CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'api' END;
  END IF;

  INSERT INTO lead_stage_events (lead_id, from_stage, to_stage, changed_by, origem)
  VALUES (NEW.id, OLD.stage, NEW.stage, v_user, v_origem);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION central_registra_evento_automacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_automation_events (lead_id, paused, changed_by)
  VALUES (NEW.id, COALESCE(NEW.automation_paused, false), COALESCE(auth.uid()::text, 'motor_ia'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_stage_event ON leads;
CREATE TRIGGER leads_stage_event
  AFTER UPDATE OF stage ON leads
  FOR EACH ROW WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION central_registra_evento_estagio();

DROP TRIGGER IF EXISTS leads_automation_event ON leads;
CREATE TRIGGER leads_automation_event
  AFTER UPDATE OF automation_paused ON leads
  FOR EACH ROW WHEN (OLD.automation_paused IS DISTINCT FROM NEW.automation_paused)
  EXECUTE FUNCTION central_registra_evento_automacao();

INSERT INTO lead_stage_events (lead_id, from_stage, to_stage, changed_at, changed_by, origem)
SELECT l.id, NULL, l.stage, COALESCE(l.updated_at, l.created_at, now()), 'motor_ia', 'backfill'
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM lead_stage_events e WHERE e.lead_id = l.id
);

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_saida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feriados: autenticados leem" ON feriados;
CREATE POLICY "feriados: autenticados leem" ON feriados
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feriados: adm gerencia" ON feriados;
CREATE POLICY "feriados: adm gerencia" ON feriados
  FOR ALL TO authenticated USING (is_adm()) WITH CHECK (is_adm());

DROP POLICY IF EXISTS "configuracoes: autenticados leem" ON configuracoes_sistema;
CREATE POLICY "configuracoes: autenticados leem" ON configuracoes_sistema
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "configuracoes: adm gerencia" ON configuracoes_sistema;
CREATE POLICY "configuracoes: adm gerencia" ON configuracoes_sistema
  FOR ALL TO authenticated USING (is_adm()) WITH CHECK (is_adm());

DROP POLICY IF EXISTS "eventos: autenticados leem" ON lead_stage_events;
CREATE POLICY "eventos: autenticados leem" ON lead_stage_events
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "automacao eventos: autenticados leem" ON lead_automation_events;
CREATE POLICY "automacao eventos: autenticados leem" ON lead_automation_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tarefas: responsavel ou adm le" ON tarefas;
CREATE POLICY "tarefas: responsavel ou adm le" ON tarefas
  FOR SELECT TO authenticated USING (responsavel_id = auth.uid() OR is_adm());
DROP POLICY IF EXISTS "tarefas: responsavel ou adm atualiza" ON tarefas;
CREATE POLICY "tarefas: responsavel ou adm atualiza" ON tarefas
  FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() OR is_adm())
  WITH CHECK (responsavel_id = auth.uid() OR is_adm());

DROP POLICY IF EXISTS "ligacoes: responsavel ou adm le" ON ligacoes;
CREATE POLICY "ligacoes: responsavel ou adm le" ON ligacoes
  FOR SELECT TO authenticated USING (responsavel_id = auth.uid() OR is_adm());
DROP POLICY IF EXISTS "ligacoes: responsavel ou adm insere" ON ligacoes;
CREATE POLICY "ligacoes: responsavel ou adm insere" ON ligacoes
  FOR INSERT TO authenticated WITH CHECK (responsavel_id = auth.uid() OR is_adm());
DROP POLICY IF EXISTS "ligacoes: responsavel ou adm atualiza" ON ligacoes;
CREATE POLICY "ligacoes: responsavel ou adm atualiza" ON ligacoes
  FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() OR is_adm())
  WITH CHECK (responsavel_id = auth.uid() OR is_adm());

DROP POLICY IF EXISTS "fila: responsavel ou adm le" ON fila_diaria;
CREATE POLICY "fila: responsavel ou adm le" ON fila_diaria
  FOR SELECT TO authenticated USING (responsavel_id = auth.uid() OR is_adm());

REVOKE ALL ON mensagens_saida FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON lead_stage_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON lead_automation_events FROM anon, authenticated;
GRANT SELECT ON feriados, configuracoes_sistema, lead_stage_events, lead_automation_events TO authenticated;
GRANT SELECT, UPDATE ON tarefas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ligacoes TO authenticated;
GRANT SELECT ON fila_diaria TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tarefas;
  END IF;
END;
$$;
