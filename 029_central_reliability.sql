-- Central do Dia: reliable cron execution, transactional outbox and safe call undo.
-- Depends on migrations 023 through 028. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

ALTER TABLE mensagens_saida
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ultimo_erro_em timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS idx_mensagens_saida_retry
  ON mensagens_saida (proxima_tentativa_em, criada_em)
  WHERE enviada_em IS NULL;

CREATE TABLE IF NOT EXISTS central_cron_runs (
  id uuid PRIMARY KEY,
  job_name text NOT NULL,
  reference_date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS idx_central_cron_runs_job
  ON central_cron_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_central_cron_runs_failures
  ON central_cron_runs (started_at DESC) WHERE status='failed';

ALTER TABLE central_cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cron runs: adm le" ON central_cron_runs;
CREATE POLICY "cron runs: adm le" ON central_cron_runs
  FOR SELECT TO authenticated USING (is_adm());
REVOKE ALL ON central_cron_runs FROM anon, authenticated;
GRANT SELECT ON central_cron_runs TO authenticated;
GRANT ALL ON central_cron_runs TO service_role;

CREATE OR REPLACE FUNCTION central_ultimas_interacoes(p_lead_ids uuid[])
RETURNS TABLE(lead_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (i.lead_id) i.lead_id, i.created_at
  FROM interactions i
  WHERE i.lead_id = ANY(COALESCE(p_lead_ids, ARRAY[]::uuid[]))
  ORDER BY i.lead_id, i.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION central_ultimas_interacoes(uuid[]) TO authenticated;

-- Qualification alerts must use the configured group. Missing configuration
-- never blocks qualification, but it also never sends to an implicit group.
CREATE OR REPLACE FUNCTION central_cria_tarefa_qualificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_group text;
  v_crm_url text;
BEGIN
  IF NEW.stage IS DISTINCT FROM 'lead_quente'
    OR OLD.stage = 'lead_quente'
    OR NEW.primeira_ligacao_em IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  v_responsavel := central_responsavel_padrao(NEW.assigned_to);
  IF v_responsavel IS NULL THEN RETURN NEW; END IF;

  INSERT INTO tarefas (lead_id, responsavel_id, origem, vence_em)
  VALUES (NEW.id, v_responsavel, 'qualificacao', NEW.prazo_primeiro_contato)
  ON CONFLICT DO NOTHING;

  SELECT NULLIF(btrim(valor->>'grupo_whatsapp'), ''),
         COALESCE(NULLIF(btrim(valor->>'crm_base_url'), ''), 'https://crm-alliance.vercel.app')
    INTO v_group, v_crm_url
  FROM configuracoes_sistema
  WHERE chave='central_do_dia';

  IF v_group IS NULL THEN RETURN NEW; END IF;

  INSERT INTO mensagens_saida (destino, destino_tipo, corpo, contexto)
  VALUES (
    v_group,
    'grupo',
    format(
      E'*FOLLOW UP PENDENTE*\n\n%s está aguardando ligação.\nQualificada em %s.\n\nAbrir lead:\n%s/kanban?lead=%s',
      NEW.name,
      to_char(NEW.qualificado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      v_crm_url,
      NEW.id
    ),
    jsonb_build_object(
      'tipo', 'lead_qualificado',
      'lead_id', NEW.id,
      'idempotency_key', 'qualificado:' || NEW.id::text || ':' || NEW.qualificado_em::text
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- A transaction-level lock makes retries and concurrent invocations harmless.
-- Existing queue entries retain their positions; newly due tasks are appended.
CREATE OR REPLACE FUNCTION montar_fila_diaria(p_data date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS TABLE(fila_id uuid, tarefa_id uuid, lead_id uuid, responsavel_id uuid, faixa text, posicao integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_responsavel uuid;
  v_limite integer := 3;
  v_resgate_ja_gerado boolean := false;
BEGIN
  IF extract(isodow FROM p_data) IN (6,7)
    OR EXISTS (SELECT 1 FROM feriados WHERE data=p_data)
  THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('montar_fila_diaria:' || p_data::text));

  WITH elegiveis AS (
    SELECT t.*
    FROM tarefas t
    JOIN leads l ON l.id=t.lead_id
    WHERE (t.status='pendente' OR (t.status='vencida' AND t.origem <> 'resgate'))
      AND (t.vence_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_data
      AND NOT EXISTS (
        SELECT 1 FROM fila_diaria fd WHERE fd.data=p_data AND fd.tarefa_id=t.id
      )
      AND (
        (t.origem='qualificacao' AND l.stage='lead_quente' AND l.primeira_ligacao_em IS NULL)
        OR (t.origem='resgate' AND l.stage IN ('lead_morno','lead_quente') AND l.primeira_ligacao_em IS NULL)
        OR t.origem IN ('retorno_agendado','retentativa','manual')
      )
  ), numeradas AS (
    SELECT e.*,
      row_number() OVER (PARTITION BY e.responsavel_id ORDER BY
        CASE WHEN e.status='vencida' THEN 0 ELSE 1 END,e.vence_em,e.criada_em)::integer AS rn
    FROM elegiveis e
  )
  INSERT INTO fila_diaria (data,responsavel_id,tarefa_id,posicao,faixa)
  SELECT p_data,n.responsavel_id,n.id,
    COALESCE((SELECT max(fd.posicao) FROM fila_diaria fd
      WHERE fd.data=p_data AND fd.responsavel_id=n.responsavel_id),0)+n.rn,
    NULL
  FROM numeradas n
  ON CONFLICT DO NOTHING;

  PERFORM recalcular_scores_resgate();
  v_responsavel := central_responsavel_padrao(NULL);
  SELECT COALESCE((valor->>'resgate_diario_padrao')::integer,3)
    INTO v_limite
  FROM configuracoes_sistema WHERE chave='central_do_dia';
  v_limite := GREATEST(0,LEAST(COALESCE(v_limite,3),20));

  IF v_responsavel IS NOT NULL AND v_limite > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM fila_diaria fd
      JOIN tarefas t ON t.id=fd.tarefa_id
      JOIN leads l ON l.id=t.lead_id
      WHERE fd.data=p_data AND fd.responsavel_id=v_responsavel
        AND t.origem='resgate' AND t.status IN ('pendente','vencida')
        AND l.stage IN ('lead_morno','lead_quente') AND l.primeira_ligacao_em IS NULL
    ) INTO v_resgate_ja_gerado;

    WITH candidatos AS (
      SELECT l.*,ntile(3) OVER (ORDER BY l.score_resgate DESC NULLS LAST) AS tercil
      FROM leads l
      WHERE l.stage IN ('lead_morno','lead_quente')
        AND l.primeira_ligacao_em IS NULL
        AND l.resgate_status='elegivel'
        AND (l.ultima_vez_na_fila IS NULL OR l.ultima_vez_na_fila < p_data-10)
        AND NOT EXISTS (
          SELECT 1 FROM tarefas t WHERE t.lead_id=l.id AND t.status IN ('pendente','vencida')
        )
    ), escolhidos AS (
      SELECT * FROM (
        SELECT c.*,row_number() OVER (
          PARTITION BY tercil ORDER BY score_resgate DESC NULLS LAST,updated_at DESC
        ) rn
        FROM candidatos c
      ) ranked
      WHERE rn=1
      ORDER BY tercil
      LIMIT CASE WHEN v_resgate_ja_gerado THEN 0 ELSE v_limite END
    ), novas AS (
      INSERT INTO tarefas (lead_id,responsavel_id,origem,vence_em)
      SELECT id,v_responsavel,'resgate',(p_data::timestamp+time '20:00') AT TIME ZONE 'America/Sao_Paulo'
      FROM escolhidos
      ON CONFLICT DO NOTHING
      RETURNING id,lead_id,responsavel_id
    ), inseridas AS (
      INSERT INTO fila_diaria (data,responsavel_id,tarefa_id,posicao,faixa)
      SELECT p_data,n.responsavel_id,n.id,
        COALESCE((SELECT max(fd.posicao) FROM fila_diaria fd
          WHERE fd.data=p_data AND fd.responsavel_id=n.responsavel_id),0)
          + row_number() OVER (ORDER BY e.tercil)::integer,
        CASE e.tercil WHEN 1 THEN 'alta' WHEN 2 THEN 'media' ELSE 'longo_prazo' END
      FROM novas n JOIN escolhidos e ON e.id=n.lead_id
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    UPDATE leads l SET resgate_status='na_fila',ultima_vez_na_fila=p_data
    WHERE EXISTS (SELECT 1 FROM novas n WHERE n.lead_id=l.id);
  END IF;

  RETURN QUERY
  SELECT fd.id,fd.tarefa_id,t.lead_id,fd.responsavel_id,fd.faixa,fd.posicao
  FROM fila_diaria fd
  JOIN tarefas t ON t.id=fd.tarefa_id
  JOIN leads l ON l.id=t.lead_id
  WHERE fd.data=p_data
    AND t.status IN ('pendente','vencida')
    AND (
      (t.origem='qualificacao' AND l.stage='lead_quente' AND l.primeira_ligacao_em IS NULL)
      OR (t.origem='resgate' AND l.stage IN ('lead_morno','lead_quente') AND l.primeira_ligacao_em IS NULL)
      OR t.origem IN ('retorno_agendado','retentativa','manual')
    )
  ORDER BY fd.responsavel_id,fd.posicao;
END;
$$;

REVOKE ALL ON FUNCTION montar_fila_diaria(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION montar_fila_diaria(date) TO service_role;

-- Capture the state produced by a call and only undo it while the lead still
-- matches that state. This prevents an undo from clobbering later CRM work.
ALTER TABLE ligacoes ADD COLUMN IF NOT EXISTS estado_posterior jsonb;

DO $$
BEGIN
  IF to_regprocedure('registrar_ligacao_v2_impl(uuid,ligacao_desfecho,text,timestamptz,boolean,text)') IS NULL THEN
    ALTER FUNCTION registrar_ligacao_v2(uuid,ligacao_desfecho,text,timestamptz,boolean,text)
      RENAME TO registrar_ligacao_v2_impl;
  END IF;
  IF to_regprocedure('desfazer_ligacao_v2_impl(uuid)') IS NULL THEN
    ALTER FUNCTION desfazer_ligacao_v2(uuid) RENAME TO desfazer_ligacao_v2_impl;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_ligacao_v2(
  p_tarefa_id uuid,
  p_desfecho ligacao_desfecho,
  p_observacao text DEFAULT NULL,
  p_retorno_em timestamptz DEFAULT NULL,
  p_marcou_reuniao boolean DEFAULT false,
  p_motivo_perda text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_ligacao_id uuid;
BEGIN
  v_result := registrar_ligacao_v2_impl(
    p_tarefa_id,p_desfecho,p_observacao,p_retorno_em,p_marcou_reuniao,p_motivo_perda
  );
  v_ligacao_id := (v_result->'call'->>'id')::uuid;

  UPDATE ligacoes c
  SET estado_posterior=jsonb_build_object(
    'stage',l.stage,
    'primeira_ligacao_em',l.primeira_ligacao_em,
    'tentativas_ligacao',l.tentativas_ligacao,
    'ultimo_contato_em',l.ultimo_contato_em,
    'ultimo_desfecho',l.ultimo_desfecho,
    'resgate_status',l.resgate_status,
    'motivo_perda',l.motivo_perda,
    'dados_a_corrigir',l.dados_a_corrigir
  )
  FROM leads l
  WHERE c.id=v_ligacao_id AND l.id=c.lead_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION desfazer_ligacao_v2(p_ligacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligacao ligacoes%ROWTYPE;
  v_atual jsonb;
BEGIN
  SELECT * INTO v_ligacao
  FROM ligacoes WHERE id=p_ligacao_id AND excluida_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligacao nao encontrada'; END IF;

  PERFORM 1 FROM leads WHERE id=v_ligacao.lead_id FOR UPDATE;
  IF v_ligacao.estado_posterior IS NOT NULL THEN
    SELECT jsonb_build_object(
      'stage',l.stage,
      'primeira_ligacao_em',l.primeira_ligacao_em,
      'tentativas_ligacao',l.tentativas_ligacao,
      'ultimo_contato_em',l.ultimo_contato_em,
      'ultimo_desfecho',l.ultimo_desfecho,
      'resgate_status',l.resgate_status,
      'motivo_perda',l.motivo_perda,
      'dados_a_corrigir',l.dados_a_corrigir
    ) INTO v_atual
    FROM leads l WHERE l.id=v_ligacao.lead_id;

    IF v_atual IS DISTINCT FROM v_ligacao.estado_posterior THEN
      RAISE EXCEPTION 'O lead mudou depois desta ligacao. O registro nao pode ser desfeito automaticamente.';
    END IF;
  END IF;

  RETURN desfazer_ligacao_v2_impl(p_ligacao_id);
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_ligacao_v2(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION desfazer_ligacao_v2(uuid) TO authenticated;

-- Supabase owns delivery retries. The secret is stored separately in Vault as
-- `central_cron_secret`; no credential is committed in this migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='crm-central-delivery') THEN
    PERFORM cron.unschedule('crm-central-delivery');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='crm-central-daily-recovery') THEN
    PERFORM cron.unschedule('crm-central-daily-recovery');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='crm-central-close-recovery') THEN
    PERFORM cron.unschedule('crm-central-close-recovery');
  END IF;
END;
$$;

SELECT cron.schedule(
  'crm-central-delivery',
  '*/5 * * * *',
  $job$
    SELECT net.http_get(
      url := rtrim(c.valor->>'crm_base_url','/') || '/api/cron/entregar-mensagens',
      headers := jsonb_build_object('Authorization','Bearer ' || s.decrypted_secret),
      timeout_milliseconds := 20000
    )
    FROM configuracoes_sistema c
    CROSS JOIN vault.decrypted_secrets s
    WHERE c.chave='central_do_dia' AND s.name='central_cron_secret';
  $job$
);

SELECT cron.schedule(
  'crm-central-daily-recovery',
  '10 11 * * 1-5',
  $job$
    SELECT net.http_get(
      url := rtrim(c.valor->>'crm_base_url','/') || '/api/cron/montar-fila-diaria',
      headers := jsonb_build_object('Authorization','Bearer ' || s.decrypted_secret),
      timeout_milliseconds := 60000
    )
    FROM configuracoes_sistema c
    CROSS JOIN vault.decrypted_secrets s
    WHERE c.chave='central_do_dia' AND s.name='central_cron_secret';
  $job$
);

SELECT cron.schedule(
  'crm-central-close-recovery',
  '10 23 * * 1-5',
  $job$
    SELECT net.http_get(
      url := rtrim(c.valor->>'crm_base_url','/') || '/api/cron/fechar-dia',
      headers := jsonb_build_object('Authorization','Bearer ' || s.decrypted_secret),
      timeout_milliseconds := 20000
    )
    FROM configuracoes_sistema c
    CROSS JOIN vault.decrypted_secrets s
    WHERE c.chave='central_do_dia' AND s.name='central_cron_secret';
  $job$
);
