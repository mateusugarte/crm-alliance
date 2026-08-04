-- Central do Dia: qualification, call outcomes, rescue queue and cron RPCs.
-- Depends on 023_central_do_dia_foundation.sql.

CREATE OR REPLACE FUNCTION central_responsavel_padrao(p_preferido uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_preferido IS NOT NULL AND EXISTS (SELECT 1 FROM user_profiles WHERE id = p_preferido) THEN
    RETURN p_preferido;
  END IF;

  SELECT NULLIF(valor->>'responsavel_resgate_id', '')::uuid INTO v_id
  FROM configuracoes_sistema WHERE chave = 'central_do_dia';
  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM user_profiles WHERE id = v_id) THEN
    RETURN v_id;
  END IF;

  SELECT p.id INTO v_id
  FROM user_profiles p
  LEFT JOIN login_logs ll ON ll.user_id = p.id
  WHERE p.role = 'corretor' AND p.full_name ILIKE '%jaque%'
  GROUP BY p.id, p.created_at
  ORDER BY max(ll.logged_at) DESC NULLS LAST, p.created_at
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM user_profiles
    WHERE role = 'corretor' ORDER BY created_at LIMIT 1;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION central_prepara_qualificacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_qualificou boolean;
BEGIN
  v_qualificou := (NEW.stage = 'lead_quente' AND OLD.stage IS DISTINCT FROM 'lead_quente')
    OR (NEW.aceitou_consultor IS TRUE AND OLD.aceitou_consultor IS DISTINCT FROM TRUE);

  IF v_qualificou THEN
    NEW.qualificado_em := COALESCE(OLD.qualificado_em, now());
    NEW.prazo_primeiro_contato := COALESCE(
      OLD.prazo_primeiro_contato,
      calcula_prazo(COALESCE(OLD.qualificado_em, now()))
    );
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
DECLARE
  v_qualificou boolean;
  v_responsavel uuid;
BEGIN
  v_qualificou := (NEW.stage = 'lead_quente' AND OLD.stage IS DISTINCT FROM 'lead_quente')
    OR (NEW.aceitou_consultor IS TRUE AND OLD.aceitou_consultor IS DISTINCT FROM TRUE);
  IF NOT v_qualificou OR NEW.primeira_ligacao_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_responsavel := central_responsavel_padrao(NEW.assigned_to);
  IF v_responsavel IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO tarefas (lead_id, responsavel_id, origem, vence_em)
  VALUES (NEW.id, v_responsavel, 'qualificacao', NEW.prazo_primeiro_contato)
  ON CONFLICT DO NOTHING;

  INSERT INTO mensagens_saida (destino, destino_tipo, corpo, contexto)
  SELECT
    v_responsavel::text,
    'usuario',
    format(
      'Lead qualificado - %s\n\n%s interacoes · %s\n\nRegistrar no CRM → %s/kanban?lead=%s',
      NEW.name,
      COALESCE(NEW.interaction_count, 0),
      CASE WHEN NEW.primeira_ligacao_em IS NULL THEN 'nunca recebeu ligacao' ELSE 'ja recebeu contato' END,
      COALESCE((SELECT valor->>'crm_base_url' FROM configuracoes_sistema WHERE chave='central_do_dia'), 'https://crm.alliance.com.br'),
      NEW.id
    ),
    jsonb_build_object(
      'tipo', 'lead_qualificado',
      'lead_id', NEW.id,
      'idempotency_key', 'qualificado:' || NEW.id::text || ':' || NEW.qualificado_em::text
    )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_prepara_qualificacao ON leads;
CREATE TRIGGER leads_prepara_qualificacao
  BEFORE UPDATE OF stage, aceitou_consultor ON leads
  FOR EACH ROW EXECUTE FUNCTION central_prepara_qualificacao();

DROP TRIGGER IF EXISTS leads_cria_tarefa_qualificacao ON leads;
CREATE TRIGGER leads_cria_tarefa_qualificacao
  AFTER UPDATE OF stage, aceitou_consultor ON leads
  FOR EACH ROW EXECUTE FUNCTION central_cria_tarefa_qualificacao();

CREATE OR REPLACE FUNCTION move_lead_stage_context(
  lead_uuid uuid,
  new_stage text,
  p_motivo_perda text DEFAULT NULL,
  p_origem text DEFAULT 'kanban'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  PERFORM set_config('app.user_id', auth.uid()::text, true);
  PERFORM set_config('app.origem', COALESCE(NULLIF(p_origem, ''), 'kanban'), true);

  UPDATE leads
  SET stage = new_stage,
      motivo_perda = CASE
        WHEN new_stage = 'sem_interesse' THEN NULLIF(btrim(p_motivo_perda), '')
        ELSE motivo_perda
      END,
      updated_at = now()
  WHERE id = lead_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION proximo_dia_util(p_data date, p_dias integer DEFAULT 1)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_data date := p_data;
  v_restantes integer := GREATEST(p_dias, 0);
BEGIN
  WHILE v_restantes > 0 LOOP
    v_data := v_data + 1;
    IF extract(isodow FROM v_data) NOT IN (6, 7)
      AND NOT EXISTS (SELECT 1 FROM feriados WHERE data = v_data)
    THEN
      v_restantes := v_restantes - 1;
    END IF;
  END LOOP;
  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_ligacao(
  p_tarefa_id uuid,
  p_desfecho ligacao_desfecho,
  p_observacao text DEFAULT NULL,
  p_retorno_em timestamptz DEFAULT NULL,
  p_marcou_reuniao boolean DEFAULT false,
  p_reuniao_em timestamptz DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL
)
RETURNS ligacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa tarefas%ROWTYPE;
  v_ligacao ligacoes%ROWTYPE;
  v_tentativas integer;
  v_proxima timestamptz;
  v_hora integer;
BEGIN
  SELECT * INTO v_tarefa FROM tarefas WHERE id = p_tarefa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa nao encontrada'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;
  IF v_tarefa.responsavel_id <> auth.uid() AND NOT is_adm() THEN
    RAISE EXCEPTION 'Sem permissao para registrar esta ligacao';
  END IF;
  IF p_desfecho = 'pediu_retorno' AND p_retorno_em IS NULL THEN
    RAISE EXCEPTION 'Data de retorno obrigatoria';
  END IF;
  IF p_desfecho = 'sem_interesse' AND NULLIF(btrim(p_motivo_perda), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo de perda obrigatorio';
  END IF;
  IF p_marcou_reuniao AND p_reuniao_em IS NULL THEN
    RAISE EXCEPTION 'Data da reuniao obrigatoria';
  END IF;

  INSERT INTO ligacoes (
    lead_id, tarefa_id, responsavel_id, desfecho, retorno_em,
    observacao, marcou_reuniao, reuniao_em
  ) VALUES (
    v_tarefa.lead_id, v_tarefa.id, auth.uid(), p_desfecho, p_retorno_em,
    NULLIF(btrim(p_observacao), ''), p_marcou_reuniao, p_reuniao_em
  ) RETURNING * INTO v_ligacao;

  UPDATE tarefas SET
    status = 'feita', concluida_em = now(), observacao = NULLIF(btrim(p_observacao), '')
  WHERE id = v_tarefa.id;

  UPDATE leads SET
    primeira_ligacao_em = COALESCE(primeira_ligacao_em, now()),
    tentativas_ligacao = tentativas_ligacao + 1,
    ultimo_contato_em = now(),
    ultimo_desfecho = p_desfecho,
    resgate_status = CASE
      WHEN p_desfecho = 'numero_errado' THEN 'inelegivel'
      WHEN p_desfecho = 'sem_interesse' THEN 'inelegivel'
      WHEN p_desfecho IN ('nao_atendeu', 'caixa_postal') AND tentativas_ligacao + 1 >= 4 THEN 'arquivado'
      ELSE 'trabalhado'
    END,
    motivo_perda = CASE WHEN p_desfecho = 'sem_interesse' THEN btrim(p_motivo_perda) ELSE motivo_perda END,
    stage = CASE WHEN p_desfecho = 'sem_interesse' THEN 'sem_interesse' ELSE stage END,
    updated_at = now()
  WHERE id = v_tarefa.lead_id
  RETURNING tentativas_ligacao INTO v_tentativas;

  IF p_marcou_reuniao THEN
    INSERT INTO meetings (lead_id, assigned_to, datetime, notes, status, title)
    VALUES (
      v_tarefa.lead_id, auth.uid(), p_reuniao_em,
      NULLIF(btrim(p_observacao), ''), 'scheduled', 'Reuniao comercial'
    );
    UPDATE leads SET stage = 'reuniao_agendada', updated_at = now()
    WHERE id = v_tarefa.lead_id AND stage <> 'cliente';
  ELSIF p_desfecho IN ('nao_atendeu', 'caixa_postal') AND v_tentativas < 4 THEN
    v_hora := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo');
    v_proxima := (
      proximo_dia_util((now() AT TIME ZONE 'America/Sao_Paulo')::date, 3)::timestamp
      + CASE WHEN v_hora < 13 THEN time '15:00' ELSE time '09:30' END
    ) AT TIME ZONE 'America/Sao_Paulo';
    INSERT INTO tarefas (lead_id, responsavel_id, origem, tentativa_num, vence_em)
    VALUES (v_tarefa.lead_id, v_tarefa.responsavel_id, 'retentativa', v_tentativas + 1, v_proxima)
    ON CONFLICT DO NOTHING;
  ELSIF p_desfecho = 'pediu_retorno' THEN
    INSERT INTO tarefas (lead_id, responsavel_id, origem, tentativa_num, vence_em)
    VALUES (v_tarefa.lead_id, v_tarefa.responsavel_id, 'retorno_agendado', v_tentativas + 1, p_retorno_em)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_ligacao;
END;
$$;

CREATE OR REPLACE FUNCTION desfazer_ligacao(p_ligacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v ligacoes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM ligacoes WHERE id = p_ligacao_id AND excluida_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligacao nao encontrada'; END IF;
  IF v.responsavel_id <> auth.uid() AND NOT is_adm() THEN RAISE EXCEPTION 'Sem permissao'; END IF;

  UPDATE ligacoes SET excluida_em = now(), excluida_por = auth.uid() WHERE id = v.id;
  UPDATE tarefas SET status = 'pendente', concluida_em = NULL, observacao = NULL WHERE id = v.tarefa_id;
  UPDATE tarefas SET status = 'cancelada' WHERE lead_id = v.lead_id
    AND origem IN ('retentativa', 'retorno_agendado') AND status = 'pendente' AND criada_em >= v.registrada_em;

  UPDATE leads l SET
    tentativas_ligacao = GREATEST(0, l.tentativas_ligacao - 1),
    primeira_ligacao_em = (SELECT min(registrada_em) FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL),
    ultimo_contato_em = (SELECT max(registrada_em) FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL),
    ultimo_desfecho = (SELECT desfecho FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL ORDER BY registrada_em DESC LIMIT 1),
    resgate_status = 'elegivel'
  WHERE l.id = v.lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION recalcular_scores_resgate()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH sinais AS (
    SELECT
      l.id,
      EXISTS (
        SELECT 1 FROM interactions i
        WHERE i.lead_id=l.id
          AND i.id = (SELECT i2.id FROM interactions i2 WHERE i2.lead_id=l.id ORDER BY i2.created_at DESC LIMIT 1)
          AND i.direction='inbound'
      ) AS lead_falou_ultimo,
      COALESCE(l.lead_score_reasons::text ~* '(preco|valor|planta|tabela|reuniao|simulacao)', false) AS sinal_intencao
    FROM leads l
  )
  UPDATE leads l SET
    score_resgate = GREATEST(0,
      COALESCE(l.lead_score, 0)
      + CASE WHEN l.primeira_ligacao_em IS NULL THEN 15 ELSE 0 END
      + CASE WHEN l.aceitou_consultor IS TRUE THEN 20 ELSE 0 END
      + CASE WHEN s.lead_falou_ultimo THEN 10 ELSE 0 END
      + CASE WHEN s.sinal_intencao THEN 8 ELSE 0 END
      - (0.2 * GREATEST(0, extract(epoch FROM (now() - COALESCE(l.ultimo_contato_em, l.updated_at, l.created_at))) / 86400))
      - (20 * COALESCE(l.tentativas_ligacao, 0))
    ),
    score_resgate_em = now()
  FROM sinais s
  WHERE l.id=s.id
    AND l.stage IN ('lead_morno','lead_quente','follow_up','reuniao_agendada')
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
  IF extract(isodow FROM p_data) IN (6,7) OR EXISTS (SELECT 1 FROM feriados WHERE data=p_data) THEN
    RETURN;
  END IF;

  PERFORM recalcular_scores_resgate();
  v_responsavel := central_responsavel_padrao(NULL);
  SELECT COALESCE((valor->>'resgate_diario_padrao')::integer, 3)
  INTO v_limite FROM configuracoes_sistema WHERE chave='central_do_dia';
  v_limite := GREATEST(0, LEAST(COALESCE(v_limite, 3), 20));
  IF v_responsavel IS NULL OR v_limite=0 THEN RETURN; END IF;

  -- Materialize all already active tasks that are due today or overdue.
  INSERT INTO fila_diaria (data, responsavel_id, tarefa_id, posicao, faixa)
  SELECT p_data, t.responsavel_id, t.id,
    row_number() OVER (PARTITION BY t.responsavel_id ORDER BY
      CASE WHEN t.status='vencida' THEN 0 ELSE 1 END, t.vence_em, t.criada_em)::integer,
    NULL
  FROM tarefas t
  WHERE (t.status='pendente' OR (t.status='vencida' AND t.origem <> 'resgate'))
    AND (t.vence_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_data
  ON CONFLICT DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM fila_diaria fd
    JOIN tarefas t ON t.id=fd.tarefa_id
    WHERE fd.data=p_data AND fd.responsavel_id=v_responsavel AND t.origem='resgate'
  ) INTO v_resgate_ja_gerado;

  WITH elegiveis AS (
    SELECT l.*,
      ntile(3) OVER (ORDER BY l.score_resgate DESC NULLS LAST) AS tercil
    FROM leads l
    WHERE l.stage IN ('lead_morno','lead_quente','follow_up','reuniao_agendada')
      AND l.resgate_status='elegivel'
      AND l.tentativas_ligacao < 4
      AND (l.ultimo_contato_em IS NULL OR l.ultimo_contato_em < now()-interval '3 days')
      AND (l.ultima_vez_na_fila IS NULL OR l.ultima_vez_na_fila < p_data-10)
      AND l.ultimo_desfecho IS DISTINCT FROM 'numero_errado'::ligacao_desfecho
      AND l.ultimo_desfecho IS DISTINCT FROM 'sem_interesse'::ligacao_desfecho
      AND NOT EXISTS (SELECT 1 FROM tarefas t WHERE t.lead_id=l.id AND t.status='pendente')
  ), escolhidos AS (
    SELECT * FROM (
      SELECT e.*,
        row_number() OVER (PARTITION BY tercil ORDER BY score_resgate DESC NULLS LAST, updated_at DESC) rn
      FROM elegiveis e
    ) ranked
    WHERE rn=1
    ORDER BY tercil
    LIMIT CASE WHEN v_resgate_ja_gerado THEN 0 ELSE v_limite END
  ), novas AS (
    INSERT INTO tarefas (lead_id, responsavel_id, origem, vence_em)
    SELECT id, v_responsavel, 'resgate',
      (p_data::timestamp + time '20:00') AT TIME ZONE 'America/Sao_Paulo'
    FROM escolhidos
    ON CONFLICT DO NOTHING
    RETURNING id, lead_id, responsavel_id
  ), inseridas AS (
    INSERT INTO fila_diaria (data, responsavel_id, tarefa_id, posicao, faixa)
    SELECT p_data, n.responsavel_id, n.id,
      COALESCE((SELECT max(fd.posicao) FROM fila_diaria fd WHERE fd.data=p_data AND fd.responsavel_id=n.responsavel_id), 0)
        + row_number() OVER (ORDER BY e.tercil)::integer,
      CASE e.tercil WHEN 1 THEN 'alta' WHEN 2 THEN 'media' ELSE 'longo_prazo' END
    FROM novas n JOIN escolhidos e ON e.id=n.lead_id
    ON CONFLICT DO NOTHING
    RETURNING id, tarefa_id, responsavel_id, faixa, posicao
  )
  UPDATE leads l SET resgate_status='na_fila', ultima_vez_na_fila=p_data
  WHERE EXISTS (SELECT 1 FROM novas n WHERE n.lead_id=l.id);

  INSERT INTO mensagens_saida (destino, destino_tipo, corpo, contexto)
  SELECT
    fd.responsavel_id::text,
    'usuario',
    format(
      'Suas ligacoes de hoje - %s\n\n%s\n\nAbrir a fila → %s/dashboard',
      count(*),
      string_agg(format('%s. %s · %s', fd.posicao, l.name,
        CASE fd.faixa WHEN 'alta' THEN 'prioridade alta' WHEN 'media' THEN 'prioridade media' WHEN 'longo_prazo' THEN 'vale um contato' ELSE t.origem::text END
      ), E'\n' ORDER BY fd.posicao),
      COALESCE((SELECT valor->>'crm_base_url' FROM configuracoes_sistema WHERE chave='central_do_dia'), 'https://crm.alliance.com.br')
    ),
    jsonb_build_object('tipo','fila_diaria','data',p_data,'responsavel_id',fd.responsavel_id,
      'idempotency_key','fila:'||p_data::text||':'||fd.responsavel_id::text)
  FROM fila_diaria fd
  JOIN tarefas t ON t.id=fd.tarefa_id
  JOIN leads l ON l.id=t.lead_id
  WHERE fd.data=p_data
  GROUP BY fd.responsavel_id
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT fd.id, fd.tarefa_id, t.lead_id, fd.responsavel_id, fd.faixa, fd.posicao
  FROM fila_diaria fd JOIN tarefas t ON t.id=fd.tarefa_id
  WHERE fd.data=p_data ORDER BY fd.responsavel_id, fd.posicao;
END;
$$;

CREATE OR REPLACE FUNCTION verificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_group text;
BEGIN
  SELECT valor->>'grupo_whatsapp' INTO v_group FROM configuracoes_sistema WHERE chave='central_do_dia';

  WITH vencidas AS (
    UPDATE tarefas t SET status='vencida', escalonada_em=now()
    WHERE t.origem='qualificacao' AND t.status='pendente'
      AND t.vence_em <= now() AND t.escalonada_em IS NULL
    RETURNING t.*
  ), mensagens AS (
    INSERT INTO mensagens_saida (destino, destino_tipo, corpo, contexto)
    SELECT COALESCE(v_group, 'grupo_interno'), 'grupo',
      format('Lead qualificado ha 36h sem ligacao registrada\n\n%s · %s\nResponsavel: %s\n\n%s/kanban?lead=%s',
        l.name, to_char(l.qualificado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),
        p.full_name,
        COALESCE((SELECT valor->>'crm_base_url' FROM configuracoes_sistema WHERE chave='central_do_dia'),'https://crm.alliance.com.br'),
        l.id),
      jsonb_build_object('tipo','prazo_estourado','tarefa_id',v.id,
        'idempotency_key','prazo:'||v.id::text)
    FROM vencidas v JOIN leads l ON l.id=v.lead_id
    JOIN user_profiles p ON p.id=v.responsavel_id
    ON CONFLICT DO NOTHING RETURNING 1
  ) SELECT count(*) INTO v_count FROM mensagens;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fechar_fila_do_dia(p_data date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH fechadas AS (
    UPDATE tarefas t SET status='vencida'
    FROM fila_diaria f
    WHERE f.tarefa_id=t.id AND f.data=p_data AND t.origem='resgate' AND t.status='pendente'
    RETURNING t.lead_id
  )
  UPDATE leads l SET resgate_status='elegivel'
  WHERE EXISTS (SELECT 1 FROM fechadas f WHERE f.lead_id=l.id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Backfill qualification timestamps and currently actionable qualified tasks.
UPDATE leads
SET qualificado_em = COALESCE(qualificado_em, updated_at, created_at, now()),
    prazo_primeiro_contato = COALESCE(prazo_primeiro_contato, calcula_prazo(COALESCE(updated_at, created_at, now())))
WHERE (stage='lead_quente' OR aceitou_consultor IS TRUE)
  AND primeira_ligacao_em IS NULL;

INSERT INTO tarefas (lead_id, responsavel_id, origem, vence_em)
SELECT l.id, central_responsavel_padrao(l.assigned_to), 'qualificacao', l.prazo_primeiro_contato
FROM leads l
WHERE (l.stage='lead_quente' OR l.aceitou_consultor IS TRUE)
  AND l.primeira_ligacao_em IS NULL
  AND central_responsavel_padrao(l.assigned_to) IS NOT NULL
ON CONFLICT DO NOTHING;

GRANT EXECUTE ON FUNCTION calcula_prazo(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION move_lead_stage_context(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_ligacao(uuid,ligacao_desfecho,text,timestamptz,boolean,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION desfazer_ligacao(uuid) TO authenticated;
REVOKE ALL ON FUNCTION montar_fila_diaria(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION verificar_prazos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fechar_fila_do_dia(date) FROM PUBLIC, anon, authenticated;
