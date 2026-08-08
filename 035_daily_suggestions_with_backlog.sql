-- Carry the entire unfinished backlog and still add the configured daily
-- suggestion quota. The current-date predicate keeps cron retries idempotent:
-- old resgates do not block today's batch, while today's batch blocks repeats.

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
    WHERE t.status IN ('pendente','vencida')
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
        AND (t.vence_em AT TIME ZONE 'America/Sao_Paulo')::date=p_data
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
