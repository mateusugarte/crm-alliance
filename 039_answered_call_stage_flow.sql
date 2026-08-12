-- A ligacao atendida passa a concluir o trabalho comercial em uma unica transacao:
-- em conversa -> lead quente + acompanhamento em 5 dias
-- reuniao marcada -> reuniao agendada
-- sem interesse -> coluna sem interesse
--
-- A mudanca para lead quente ocorre junto com primeira_ligacao_em. Por isso o
-- trigger de qualificacao nao cria tarefa nem mensagem de primeiro contato.

CREATE OR REPLACE FUNCTION registrar_ligacao_v2_impl(
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
  v_tarefa tarefas%ROWTYPE;
  v_lead leads%ROWTYPE;
  v_ligacao ligacoes%ROWTYPE;
  v_tarefa_gerada tarefas%ROWTYPE;
  v_tentativas integer;
  v_proxima timestamptz;
  v_hora integer;
  v_titulo text;
  v_descricao text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;

  SELECT * INTO v_tarefa FROM tarefas WHERE id=p_tarefa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa nao encontrada'; END IF;
  IF v_tarefa.status NOT IN ('pendente', 'vencida') THEN
    RAISE EXCEPTION 'Esta tarefa ja foi concluida ou cancelada';
  END IF;
  IF v_tarefa.responsavel_id <> auth.uid() AND NOT is_adm() THEN
    RAISE EXCEPTION 'Sem permissao para registrar esta ligacao';
  END IF;
  IF EXISTS (SELECT 1 FROM ligacoes WHERE tarefa_id=v_tarefa.id AND excluida_em IS NULL) THEN
    RAISE EXCEPTION 'Esta tarefa ja possui uma ligacao registrada';
  END IF;

  IF p_desfecho='pediu_retorno' AND p_retorno_em IS NULL THEN
    RAISE EXCEPTION 'Informe quando retornar';
  END IF;
  IF p_desfecho='sem_interesse' AND NULLIF(btrim(p_motivo_perda), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do desinteresse';
  END IF;
  IF COALESCE(p_marcou_reuniao,false) AND p_desfecho <> 'atendeu' THEN
    RAISE EXCEPTION 'Reuniao marcada exige uma ligacao atendida';
  END IF;

  SELECT * INTO v_lead FROM leads WHERE id=v_tarefa.lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead nao encontrado'; END IF;

  INSERT INTO ligacoes (
    lead_id, tarefa_id, responsavel_id, desfecho, retorno_em, observacao,
    marcou_reuniao, reuniao_em, estado_anterior
  ) VALUES (
    v_lead.id, v_tarefa.id, auth.uid(), p_desfecho, p_retorno_em,
    NULLIF(btrim(p_observacao), ''), COALESCE(p_marcou_reuniao, false), NULL,
    jsonb_build_object(
      'stage', v_lead.stage,
      'primeira_ligacao_em', v_lead.primeira_ligacao_em,
      'tentativas_ligacao', v_lead.tentativas_ligacao,
      'ultimo_contato_em', v_lead.ultimo_contato_em,
      'ultimo_desfecho', v_lead.ultimo_desfecho,
      'resgate_status', v_lead.resgate_status,
      'motivo_perda', v_lead.motivo_perda,
      'dados_a_corrigir', v_lead.dados_a_corrigir,
      'qualificado_em', v_lead.qualificado_em,
      'prazo_primeiro_contato', v_lead.prazo_primeiro_contato
    )
  ) RETURNING * INTO v_ligacao;

  UPDATE tarefas SET
    status='feita', concluida_em=now(), observacao=NULLIF(btrim(p_observacao), '')
  WHERE id=v_tarefa.id;

  PERFORM set_config('app.user_id', auth.uid()::text, true);
  PERFORM set_config('app.origem', 'ligacao', true);

  UPDATE leads SET
    primeira_ligacao_em=COALESCE(primeira_ligacao_em, now()),
    tentativas_ligacao=tentativas_ligacao+1,
    ultimo_contato_em=now(),
    ultimo_desfecho=p_desfecho,
    resgate_status=CASE
      WHEN p_desfecho='sem_interesse' THEN 'arquivado'
      WHEN p_desfecho IN ('nao_atendeu','caixa_postal','numero_errado')
        AND tentativas_ligacao+1 >= 4 THEN 'arquivado'
      ELSE 'trabalhado'
    END,
    motivo_perda=CASE
      WHEN p_desfecho='sem_interesse' THEN btrim(p_motivo_perda)
      WHEN p_desfecho='atendeu' THEN NULL
      ELSE motivo_perda
    END,
    dados_a_corrigir=CASE WHEN p_desfecho='numero_errado' THEN true ELSE dados_a_corrigir END,
    stage=CASE
      WHEN p_desfecho='sem_interesse' THEN 'sem_interesse'
      WHEN p_desfecho='atendeu' AND COALESCE(p_marcou_reuniao,false) THEN 'reuniao_agendada'
      WHEN p_desfecho='atendeu' THEN 'lead_quente'
      ELSE stage
    END,
    updated_at=now()
  WHERE id=v_lead.id
  RETURNING tentativas_ligacao INTO v_tentativas;

  IF p_desfecho IN ('nao_atendeu','caixa_postal','numero_errado') AND v_tentativas < 4 THEN
    v_hora := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo');
    v_proxima := (
      proximo_dia_util((now() AT TIME ZONE 'America/Sao_Paulo')::date, 3)::timestamp
      + CASE WHEN v_hora < 13 THEN time '15:00' ELSE time '09:30' END
    ) AT TIME ZONE 'America/Sao_Paulo';
    INSERT INTO tarefas (lead_id,responsavel_id,origem,tentativa_num,vence_em)
    VALUES (v_lead.id,v_tarefa.responsavel_id,'retentativa',v_tentativas+1,v_proxima)
    ON CONFLICT DO NOTHING RETURNING * INTO v_tarefa_gerada;
  ELSIF p_desfecho='pediu_retorno' THEN
    INSERT INTO tarefas (lead_id,responsavel_id,origem,tentativa_num,vence_em)
    VALUES (v_lead.id,v_tarefa.responsavel_id,'retorno_agendado',v_tentativas+1,p_retorno_em)
    ON CONFLICT DO NOTHING RETURNING * INTO v_tarefa_gerada;
  ELSIF p_desfecho='atendeu' AND NOT COALESCE(p_marcou_reuniao,false) THEN
    v_proxima := (
      (now() AT TIME ZONE 'America/Sao_Paulo') + interval '5 days'
    ) AT TIME ZONE 'America/Sao_Paulo';
    INSERT INTO tarefas (lead_id,responsavel_id,origem,tentativa_num,vence_em)
    VALUES (v_lead.id,v_tarefa.responsavel_id,'acompanhamento',v_tentativas+1,v_proxima)
    ON CONFLICT DO NOTHING RETURNING * INTO v_tarefa_gerada;
  END IF;

  IF v_tarefa_gerada.id IS NOT NULL THEN
    UPDATE ligacoes SET tarefa_gerada_id=v_tarefa_gerada.id WHERE id=v_ligacao.id;
  END IF;

  v_titulo := CASE
    WHEN p_desfecho='atendeu' AND COALESCE(p_marcou_reuniao,false)
      THEN 'Ligacao atendida · reuniao marcada'
    WHEN p_desfecho='atendeu' THEN 'Ligacao atendida · em conversa'
    WHEN p_desfecho='pediu_retorno' THEN 'Lead pediu retorno'
    WHEN p_desfecho='nao_atendeu' THEN 'Lead nao atendeu'
    WHEN p_desfecho='caixa_postal' THEN 'Ligacao caiu na caixa postal'
    WHEN p_desfecho='numero_errado' THEN 'Numero informado esta incorreto'
    ELSE 'Lead sem interesse'
  END;
  v_descricao := CASE WHEN p_desfecho='sem_interesse' THEN btrim(p_motivo_perda)
    ELSE NULLIF(btrim(p_observacao), '') END;

  INSERT INTO lead_activity_events (
    lead_id,actor_id,tipo,titulo,descricao,metadata,referencia_tipo,referencia_id
  ) VALUES (
    v_lead.id,auth.uid(),'ligacao',v_titulo,v_descricao,
    jsonb_build_object(
      'desfecho',p_desfecho,
      'resultado_atendimento',CASE
        WHEN p_desfecho='atendeu' AND COALESCE(p_marcou_reuniao,false) THEN 'reuniao'
        WHEN p_desfecho='atendeu' THEN 'em_conversa'
        WHEN p_desfecho='sem_interesse' THEN 'sem_interesse'
        ELSE NULL
      END,
      'marcou_reuniao',COALESCE(p_marcou_reuniao,false),
      'retorno_em',p_retorno_em,
      'tarefa_id',v_tarefa.id,
      'tarefa_gerada_id',v_tarefa_gerada.id,
      'tentativa_num',v_tarefa.tentativa_num
    ),
    'ligacoes',v_ligacao.id
  );

  SELECT * INTO v_lead FROM leads WHERE id=v_lead.id;
  SELECT * INTO v_tarefa FROM tarefas WHERE id=v_tarefa.id;

  RETURN jsonb_build_object(
    'call', jsonb_build_object(
      'id',v_ligacao.id,'outcome',v_ligacao.desfecho,'registeredAt',v_ligacao.registrada_em,
      'note',v_ligacao.observacao,'meetingScheduled',v_ligacao.marcou_reuniao,
      'returnAt',v_ligacao.retorno_em
    ),
    'task', jsonb_build_object('id',v_tarefa.id,'status',v_tarefa.status,'completedAt',v_tarefa.concluida_em),
    'lead', jsonb_build_object(
      'id',v_lead.id,'stage',v_lead.stage,'attempts',v_lead.tentativas_ligacao,
      'firstCallAt',v_lead.primeira_ligacao_em,'lastContactAt',v_lead.ultimo_contato_em,
      'lastOutcome',v_lead.ultimo_desfecho,'lossReason',v_lead.motivo_perda,
      'dataNeedsCorrection',v_lead.dados_a_corrigir
    ),
    'nextTask', CASE WHEN v_tarefa_gerada.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_tarefa_gerada.id,'origin',v_tarefa_gerada.origem,'dueAt',v_tarefa_gerada.vence_em
    ) END
  );
END;
$$;

-- Inclui os campos de qualificacao no snapshot posterior das novas ligacoes.
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
    'dados_a_corrigir',l.dados_a_corrigir,
    'qualificado_em',l.qualificado_em,
    'prazo_primeiro_contato',l.prazo_primeiro_contato
  )
  FROM leads l
  WHERE c.id=v_ligacao_id AND l.id=c.lead_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION desfazer_ligacao_v2_impl(p_ligacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligacao ligacoes%ROWTYPE;
  v_estado jsonb;
  v_tarefa tarefas%ROWTYPE;
  v_lead leads%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;
  SELECT * INTO v_ligacao FROM ligacoes WHERE id=p_ligacao_id AND excluida_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligacao nao encontrada'; END IF;
  IF v_ligacao.responsavel_id <> auth.uid() AND NOT is_adm() THEN RAISE EXCEPTION 'Sem permissao'; END IF;
  IF EXISTS (
    SELECT 1 FROM ligacoes WHERE lead_id=v_ligacao.lead_id AND excluida_em IS NULL
      AND registrada_em > v_ligacao.registrada_em
  ) THEN
    RAISE EXCEPTION 'Nao e possivel desfazer uma ligacao anterior a outro registro';
  END IF;

  v_estado := v_ligacao.estado_anterior;
  UPDATE ligacoes SET excluida_em=now(), excluida_por=auth.uid() WHERE id=v_ligacao.id;
  IF v_ligacao.tarefa_gerada_id IS NOT NULL THEN
    UPDATE tarefas SET status='cancelada' WHERE id=v_ligacao.tarefa_gerada_id AND status IN ('pendente','vencida');
  END IF;
  UPDATE tarefas SET status='pendente', concluida_em=NULL, observacao=NULL WHERE id=v_ligacao.tarefa_id;

  IF v_estado IS NOT NULL THEN
    PERFORM set_config('app.user_id', auth.uid()::text, true);
    PERFORM set_config('app.origem', 'ligacao_desfeita', true);
    UPDATE leads SET
      stage=COALESCE(v_estado->>'stage',stage),
      primeira_ligacao_em=NULLIF(v_estado->>'primeira_ligacao_em','')::timestamptz,
      tentativas_ligacao=COALESCE((v_estado->>'tentativas_ligacao')::integer,0),
      ultimo_contato_em=NULLIF(v_estado->>'ultimo_contato_em','')::timestamptz,
      ultimo_desfecho=NULLIF(v_estado->>'ultimo_desfecho','')::ligacao_desfecho,
      resgate_status=COALESCE(v_estado->>'resgate_status','elegivel'),
      motivo_perda=NULLIF(v_estado->>'motivo_perda',''),
      dados_a_corrigir=COALESCE((v_estado->>'dados_a_corrigir')::boolean,false),
      qualificado_em=CASE WHEN v_estado ? 'qualificado_em'
        THEN NULLIF(v_estado->>'qualificado_em','')::timestamptz ELSE qualificado_em END,
      prazo_primeiro_contato=CASE WHEN v_estado ? 'prazo_primeiro_contato'
        THEN NULLIF(v_estado->>'prazo_primeiro_contato','')::timestamptz ELSE prazo_primeiro_contato END,
      updated_at=now()
    WHERE id=v_ligacao.lead_id;
  ELSE
    UPDATE leads l SET
      tentativas_ligacao=GREATEST(0,l.tentativas_ligacao-1),
      primeira_ligacao_em=(SELECT min(registrada_em) FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL),
      ultimo_contato_em=(SELECT max(registrada_em) FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL),
      ultimo_desfecho=(SELECT desfecho FROM ligacoes WHERE lead_id=l.id AND excluida_em IS NULL ORDER BY registrada_em DESC LIMIT 1),
      resgate_status='elegivel', updated_at=now()
    WHERE l.id=v_ligacao.lead_id;
  END IF;

  UPDATE lead_activity_events SET desfeita_em=now()
  WHERE referencia_tipo='ligacoes' AND referencia_id=v_ligacao.id AND desfeita_em IS NULL;
  INSERT INTO lead_activity_events (
    lead_id,actor_id,tipo,titulo,metadata,referencia_tipo,referencia_id
  ) VALUES (
    v_ligacao.lead_id,auth.uid(),'ligacao_desfeita','Registro de ligacao desfeito',
    jsonb_build_object('ligacao_id',v_ligacao.id),'ligacoes_desfeitas',v_ligacao.id
  );

  SELECT * INTO v_tarefa FROM tarefas WHERE id=v_ligacao.tarefa_id;
  SELECT * INTO v_lead FROM leads WHERE id=v_ligacao.lead_id;
  RETURN jsonb_build_object(
    'task',jsonb_build_object('id',v_tarefa.id,'status',v_tarefa.status,'completedAt',v_tarefa.concluida_em),
    'lead',jsonb_build_object(
      'id',v_lead.id,'stage',v_lead.stage,'attempts',v_lead.tentativas_ligacao,
      'firstCallAt',v_lead.primeira_ligacao_em,'lastContactAt',v_lead.ultimo_contato_em,
      'lastOutcome',v_lead.ultimo_desfecho
    )
  );
END;
$$;

-- O wrapper continua impedindo que desfazer sobrescreva alteracoes posteriores.
-- Snapshots antigos, que nao possuem os dois campos novos, continuam comparaveis.
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
    ) || CASE WHEN v_ligacao.estado_posterior ? 'qualificado_em' THEN
      jsonb_build_object(
        'qualificado_em',l.qualificado_em,
        'prazo_primeiro_contato',l.prazo_primeiro_contato
      ) ELSE '{}'::jsonb END
    INTO v_atual
    FROM leads l WHERE l.id=v_ligacao.lead_id;

    IF v_atual IS DISTINCT FROM v_ligacao.estado_posterior THEN
      RAISE EXCEPTION 'O lead mudou depois desta ligacao. O registro nao pode ser desfeito automaticamente.';
    END IF;
  END IF;

  RETURN desfazer_ligacao_v2_impl(p_ligacao_id);
END;
$$;

-- Acompanhamentos deixam de ser validos assim que o lead sai de Lead Quente.
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
        OR (t.origem='resgate' AND (NEW.stage NOT IN ('lead_morno','lead_quente') OR NEW.primeira_ligacao_em IS NOT NULL))
        OR (t.origem='acompanhamento' AND NEW.stage <> 'lead_quente')
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
        OR (t.origem='acompanhamento' AND l.stage='lead_quente')
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
      OR (t.origem='acompanhamento' AND l.stage='lead_quente')
      OR t.origem IN ('retorno_agendado','retentativa','manual')
    )
  ORDER BY fd.responsavel_id,fd.posicao;
END;
$$;

REVOKE ALL ON FUNCTION montar_fila_diaria(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION montar_fila_diaria(date) TO service_role;
GRANT EXECUTE ON FUNCTION registrar_ligacao_v2(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION desfazer_ligacao_v2(uuid) TO authenticated;
