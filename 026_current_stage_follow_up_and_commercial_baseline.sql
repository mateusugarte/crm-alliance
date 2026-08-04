-- Current-stage follow-up rules and the commercial baseline supplied on 04/08/2026.
-- Depends on 023, 024 and 025. Safe to run more than once.

INSERT INTO configuracoes_sistema (chave, valor, atualizado_em)
VALUES (
  'resultado_comercial',
  jsonb_build_object(
    'project', 'Residencial La Reserva',
    'reference_date', '04/08/2026',
    'inventory_total', 34,
    'sold_total', 20,
    'reserved_total', 4,
    'available_total', 10,
    'sold_vgv_estimated', 14894055.98,
    'method', 'Estimativa por tipologia e progressao dos valores informados na tabela geral de vendas'
  ),
  now()
)
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em;

-- A qualification task exists only while the lead is currently hot.
CREATE OR REPLACE FUNCTION central_prepara_qualificacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'lead_quente' AND OLD.stage IS DISTINCT FROM 'lead_quente' THEN
    NEW.qualificado_em := now();
    NEW.prazo_primeiro_contato := calcula_prazo(now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION central_cria_tarefa_qualificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_responsavel uuid;
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

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION central_sincroniza_tarefas_com_estagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_canceladas uuid[];
BEGIN
  WITH canceladas AS (
    UPDATE tarefas t
    SET status='cancelada', observacao='Cancelada: lead saiu dos criterios atuais da fila'
    WHERE t.lead_id=NEW.id
      AND t.status IN ('pendente','vencida')
      AND (
        (t.origem='qualificacao' AND (NEW.stage <> 'lead_quente' OR NEW.primeira_ligacao_em IS NOT NULL))
        OR
        (t.origem='resgate' AND (NEW.stage NOT IN ('lead_morno','lead_quente') OR NEW.primeira_ligacao_em IS NOT NULL))
      )
    RETURNING t.id
  )
  SELECT array_agg(id) INTO v_canceladas FROM canceladas;

  IF v_canceladas IS NOT NULL THEN
    DELETE FROM fila_diaria WHERE tarefa_id = ANY(v_canceladas);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sincroniza_tarefas_com_estagio ON leads;
CREATE TRIGGER leads_sincroniza_tarefas_com_estagio
  AFTER UPDATE OF stage, primeira_ligacao_em ON leads
  FOR EACH ROW EXECUTE FUNCTION central_sincroniza_tarefas_com_estagio();

CREATE OR REPLACE FUNCTION recalcular_scores_resgate()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH sinais AS (
    SELECT
      l.id,
      EXISTS (
        SELECT 1 FROM interactions i
        WHERE i.lead_id=l.id
          AND i.id=(SELECT i2.id FROM interactions i2 WHERE i2.lead_id=l.id ORDER BY i2.created_at DESC LIMIT 1)
          AND i.direction='inbound'
      ) AS lead_falou_ultimo,
      COALESCE(l.lead_score_reasons::text ~* '(preco|valor|planta|tabela|reuniao|simulacao)', false) AS sinal_intencao
    FROM leads l
  )
  UPDATE leads l SET
    score_resgate=GREATEST(0,
      COALESCE(l.lead_score,0)
      + 15
      + CASE WHEN l.aceitou_consultor IS TRUE THEN 20 ELSE 0 END
      + CASE WHEN s.lead_falou_ultimo THEN 10 ELSE 0 END
      + CASE WHEN s.sinal_intencao THEN 8 ELSE 0 END
      - (0.2 * GREATEST(0,extract(epoch FROM (now()-COALESCE(l.ultimo_contato_em,l.updated_at,l.created_at)))/86400))
    ),
    score_resgate_em=now()
  FROM sinais s
  WHERE l.id=s.id
    AND l.stage IN ('lead_morno','lead_quente')
    AND l.primeira_ligacao_em IS NULL
    AND l.resgate_status='elegivel';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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
  IF extract(isodow FROM p_data) IN (6,7) OR EXISTS (SELECT 1 FROM feriados WHERE data=p_data) THEN RETURN; END IF;

  PERFORM recalcular_scores_resgate();
  v_responsavel := central_responsavel_padrao(NULL);
  SELECT COALESCE((valor->>'resgate_diario_padrao')::integer,3)
  INTO v_limite FROM configuracoes_sistema WHERE chave='central_do_dia';
  v_limite := GREATEST(0,LEAST(COALESCE(v_limite,3),20));
  IF v_responsavel IS NULL OR v_limite=0 THEN RETURN; END IF;

  INSERT INTO fila_diaria (data,responsavel_id,tarefa_id,posicao,faixa)
  SELECT p_data,t.responsavel_id,t.id,
    row_number() OVER (PARTITION BY t.responsavel_id ORDER BY
      CASE WHEN t.status='vencida' THEN 0 ELSE 1 END,t.vence_em,t.criada_em)::integer,
    NULL
  FROM tarefas t
  JOIN leads l ON l.id=t.lead_id
  WHERE (t.status='pendente' OR (t.status='vencida' AND t.origem <> 'resgate'))
    AND (t.vence_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_data
    AND (
      (t.origem='qualificacao' AND l.stage='lead_quente' AND l.primeira_ligacao_em IS NULL)
      OR (t.origem='resgate' AND l.stage IN ('lead_morno','lead_quente') AND l.primeira_ligacao_em IS NULL)
      OR t.origem IN ('retorno_agendado','retentativa','manual')
    )
  ON CONFLICT DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM fila_diaria fd
    JOIN tarefas t ON t.id=fd.tarefa_id
    JOIN leads l ON l.id=t.lead_id
    WHERE fd.data=p_data AND fd.responsavel_id=v_responsavel
      AND t.origem='resgate' AND t.status IN ('pendente','vencida')
      AND l.stage IN ('lead_morno','lead_quente') AND l.primeira_ligacao_em IS NULL
  ) INTO v_resgate_ja_gerado;

  WITH elegiveis AS (
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
      SELECT e.*,row_number() OVER (
        PARTITION BY tercil ORDER BY score_resgate DESC NULLS LAST,updated_at DESC
      ) rn
      FROM elegiveis e
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
      COALESCE((SELECT max(fd.posicao) FROM fila_diaria fd WHERE fd.data=p_data AND fd.responsavel_id=n.responsavel_id),0)
        + row_number() OVER (ORDER BY e.tercil)::integer,
      CASE e.tercil WHEN 1 THEN 'alta' WHEN 2 THEN 'media' ELSE 'longo_prazo' END
    FROM novas n JOIN escolhidos e ON e.id=n.lead_id
    ON CONFLICT DO NOTHING
    RETURNING id,tarefa_id,responsavel_id,faixa,posicao
  )
  UPDATE leads l SET resgate_status='na_fila',ultima_vez_na_fila=p_data
  WHERE EXISTS (SELECT 1 FROM novas n WHERE n.lead_id=l.id);

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

-- Remove stale pending work from the queue immediately after this migration.
UPDATE tarefas t
SET status='cancelada', observacao='Cancelada: lead saiu dos criterios atuais da fila'
FROM leads l
WHERE l.id=t.lead_id
  AND t.status IN ('pendente','vencida')
  AND (
    (t.origem='qualificacao' AND (l.stage <> 'lead_quente' OR l.primeira_ligacao_em IS NOT NULL))
    OR
    (t.origem='resgate' AND (l.stage NOT IN ('lead_morno','lead_quente') OR l.primeira_ligacao_em IS NOT NULL))
  );

DELETE FROM fila_diaria fd
USING tarefas t
WHERE t.id=fd.tarefa_id AND t.status='cancelada';

GRANT EXECUTE ON FUNCTION montar_fila_diaria(date) TO service_role;
