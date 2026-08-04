-- Follow Up do Dia: canonical call transaction, shared history and approved outcomes.
-- Depends on 023_central_do_dia_foundation.sql and 024_central_do_dia_engine.sql.
-- Safe to run more than once.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS summary_comercial_curto text,
  ADD COLUMN IF NOT EXISTS summary_comercial_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS dados_a_corrigir boolean NOT NULL DEFAULT false;

ALTER TABLE ligacoes
  ADD COLUMN IF NOT EXISTS estado_anterior jsonb,
  ADD COLUMN IF NOT EXISTS tarefa_gerada_id uuid REFERENCES tarefas(id);

ALTER TABLE ligacoes DROP CONSTRAINT IF EXISTS ligacoes_reuniao_data;

CREATE TABLE IF NOT EXISTS lead_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES user_profiles(id),
  tipo text NOT NULL CHECK (tipo IN (
    'ligacao', 'ligacao_desfeita', 'reuniao_marcada', 'retorno_agendado',
    'retentativa_agendada', 'mudanca_estagio', 'comentario', 'sistema'
  )),
  titulo text NOT NULL,
  descricao text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  referencia_tipo text,
  referencia_id uuid,
  criada_em timestamptz NOT NULL DEFAULT now(),
  desfeita_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_events_lead
  ON lead_activity_events (lead_id, criada_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lead_activity_events_reference_uniq
  ON lead_activity_events (referencia_tipo, referencia_id)
  WHERE referencia_tipo IS NOT NULL AND referencia_id IS NOT NULL AND desfeita_em IS NULL;

ALTER TABLE lead_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividades: autenticados leem" ON lead_activity_events;
CREATE POLICY "atividades: autenticados leem" ON lead_activity_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ligacoes: responsavel ou adm le" ON ligacoes;
DROP POLICY IF EXISTS "ligacoes: equipe le" ON ligacoes;
CREATE POLICY "ligacoes: equipe le" ON ligacoes
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON lead_activity_events FROM anon, authenticated;
GRANT SELECT ON lead_activity_events TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ligacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ligacoes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lead_activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lead_activity_events;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION central_registra_evento_estagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user text; v_origem text; v_actor uuid; v_event_id uuid;
BEGIN
  v_user := NULLIF(current_setting('app.user_id', true), '');
  IF v_user IS NULL THEN v_user := COALESCE(auth.uid()::text, 'motor_ia'); END IF;
  v_origem := NULLIF(current_setting('app.origem', true), '');
  IF v_origem IS NULL THEN v_origem := CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'api' END; END IF;
  v_actor := CASE WHEN v_user ~* '^[0-9a-f-]{36}$' THEN v_user::uuid ELSE NULL END;

  INSERT INTO lead_stage_events (lead_id,from_stage,to_stage,changed_by,origem)
  VALUES (NEW.id,OLD.stage,NEW.stage,v_user,v_origem)
  RETURNING id INTO v_event_id;

  INSERT INTO lead_activity_events (
    lead_id,actor_id,tipo,titulo,metadata,referencia_tipo,referencia_id
  ) VALUES (
    NEW.id,v_actor,'mudanca_estagio','Lead movido de etapa',
    jsonb_build_object('from_stage',OLD.stage,'to_stage',NEW.stage,'origem',v_origem),
    'lead_stage_events',v_event_id
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION central_registra_comentario_atividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_activity_events (
    lead_id,actor_id,tipo,titulo,descricao,referencia_tipo,referencia_id
  ) VALUES (
    NEW.lead_id,NEW.user_id,'comentario','Comentario interno adicionado',NEW.content,
    'lead_comments',NEW.id
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_comments_activity ON lead_comments;
CREATE TRIGGER lead_comments_activity
  AFTER INSERT ON lead_comments FOR EACH ROW
  EXECUTE FUNCTION central_registra_comentario_atividade();

-- Seed the shared history with records that existed before this migration.
INSERT INTO lead_activity_events (
  lead_id,actor_id,tipo,titulo,descricao,metadata,referencia_tipo,referencia_id,criada_em
)
SELECT
  c.lead_id,c.responsavel_id,'ligacao',
  CASE c.desfecho
    WHEN 'atendeu' THEN 'Ligacao atendida'
    WHEN 'pediu_retorno' THEN 'Lead pediu retorno'
    WHEN 'nao_atendeu' THEN 'Lead nao atendeu'
    WHEN 'caixa_postal' THEN 'Ligacao caiu na caixa postal'
    WHEN 'numero_errado' THEN 'Numero informado esta incorreto'
    ELSE 'Lead sem interesse agora'
  END || CASE WHEN c.marcou_reuniao THEN ' · reuniao marcada' ELSE '' END,
  c.observacao,
  jsonb_build_object(
    'desfecho',c.desfecho,'marcou_reuniao',c.marcou_reuniao,
    'retorno_em',c.retorno_em,'tarefa_id',c.tarefa_id
  ),
  'ligacoes',c.id,c.registrada_em
FROM ligacoes c
WHERE c.excluida_em IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO lead_activity_events (
  lead_id,actor_id,tipo,titulo,metadata,referencia_tipo,referencia_id,criada_em
)
SELECT
  e.lead_id,
  CASE WHEN e.changed_by ~* '^[0-9a-f-]{36}$' THEN e.changed_by::uuid ELSE NULL END,
  'mudanca_estagio','Lead movido de etapa',
  jsonb_build_object('from_stage',e.from_stage,'to_stage',e.to_stage,'origem',e.origem),
  'lead_stage_events',e.id,e.changed_at
FROM lead_stage_events e
ON CONFLICT DO NOTHING;

INSERT INTO lead_activity_events (
  lead_id,actor_id,tipo,titulo,descricao,referencia_tipo,referencia_id,criada_em
)
SELECT
  c.lead_id,c.user_id,'comentario','Comentario interno adicionado',c.content,
  'lead_comments',c.id,c.created_at
FROM lead_comments c
ON CONFLICT DO NOTHING;

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

  IF p_desfecho='atendeu' AND NULLIF(btrim(p_observacao), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o que foi conversado';
  END IF;
  IF p_desfecho='pediu_retorno' AND p_retorno_em IS NULL THEN
    RAISE EXCEPTION 'Informe quando retornar';
  END IF;
  IF p_desfecho='sem_interesse' AND NULLIF(btrim(p_motivo_perda), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do desinteresse';
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
      'dados_a_corrigir', v_lead.dados_a_corrigir
    )
  ) RETURNING * INTO v_ligacao;

  UPDATE tarefas SET
    status='feita', concluida_em=now(), observacao=NULLIF(btrim(p_observacao), '')
  WHERE id=v_tarefa.id;

  UPDATE leads SET
    primeira_ligacao_em=COALESCE(primeira_ligacao_em, now()),
    tentativas_ligacao=tentativas_ligacao+1,
    ultimo_contato_em=now(),
    ultimo_desfecho=p_desfecho,
    resgate_status=CASE
      WHEN p_desfecho='sem_interesse' THEN 'elegivel'
      WHEN p_desfecho IN ('nao_atendeu','caixa_postal','numero_errado')
        AND tentativas_ligacao+1 >= 4 THEN 'arquivado'
      ELSE 'trabalhado'
    END,
    motivo_perda=CASE WHEN p_desfecho='sem_interesse' THEN btrim(p_motivo_perda) ELSE motivo_perda END,
    dados_a_corrigir=CASE WHEN p_desfecho='numero_errado' THEN true ELSE dados_a_corrigir END,
    stage=CASE WHEN p_desfecho='sem_interesse' THEN 'lead_frio' ELSE stage END,
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
  END IF;

  IF v_tarefa_gerada.id IS NOT NULL THEN
    UPDATE ligacoes SET tarefa_gerada_id=v_tarefa_gerada.id WHERE id=v_ligacao.id;
  END IF;

  v_titulo := CASE p_desfecho
    WHEN 'atendeu' THEN 'Ligacao atendida'
    WHEN 'pediu_retorno' THEN 'Lead pediu retorno'
    WHEN 'nao_atendeu' THEN 'Lead nao atendeu'
    WHEN 'caixa_postal' THEN 'Ligacao caiu na caixa postal'
    WHEN 'numero_errado' THEN 'Numero informado esta incorreto'
    ELSE 'Lead sem interesse agora'
  END;
  IF COALESCE(p_marcou_reuniao,false) THEN
    v_titulo := v_titulo || ' · reuniao marcada';
  END IF;
  v_descricao := CASE WHEN p_desfecho='sem_interesse' THEN btrim(p_motivo_perda)
    ELSE NULLIF(btrim(p_observacao), '') END;

  INSERT INTO lead_activity_events (
    lead_id,actor_id,tipo,titulo,descricao,metadata,referencia_tipo,referencia_id
  ) VALUES (
    v_lead.id,auth.uid(),'ligacao',v_titulo,v_descricao,
    jsonb_build_object(
      'desfecho',p_desfecho,
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

CREATE OR REPLACE FUNCTION desfazer_ligacao_v2(p_ligacao_id uuid)
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
    UPDATE leads SET
      stage=COALESCE(v_estado->>'stage',stage),
      primeira_ligacao_em=NULLIF(v_estado->>'primeira_ligacao_em','')::timestamptz,
      tentativas_ligacao=COALESCE((v_estado->>'tentativas_ligacao')::integer,0),
      ultimo_contato_em=NULLIF(v_estado->>'ultimo_contato_em','')::timestamptz,
      ultimo_desfecho=NULLIF(v_estado->>'ultimo_desfecho','')::ligacao_desfecho,
      resgate_status=COALESCE(v_estado->>'resgate_status','elegivel'),
      motivo_perda=NULLIF(v_estado->>'motivo_perda',''),
      dados_a_corrigir=COALESCE((v_estado->>'dados_a_corrigir')::boolean,false),
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

CREATE OR REPLACE FUNCTION verificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0; v_group text;
BEGIN
  SELECT valor->>'grupo_whatsapp' INTO v_group FROM configuracoes_sistema WHERE chave='central_do_dia';
  WITH vencidas AS (
    UPDATE tarefas t SET status='vencida',escalonada_em=now()
    WHERE t.origem='qualificacao' AND t.status='pendente'
      AND t.vence_em<=now() AND t.escalonada_em IS NULL
    RETURNING t.*
  ), mensagens AS (
    INSERT INTO mensagens_saida (destino,destino_tipo,corpo,contexto)
    SELECT COALESCE(v_group,'120363429109259182@g.us'),'grupo',
      format('*FOLLOW UP PENDENTE*\n\n%s esta aguardando ligacao.\nQualificada em %s.\n\nAbrir lead:\n%s/kanban?lead=%s',
        l.name,to_char(l.qualificado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM "as" HH24:MI'),
        COALESCE((SELECT valor->>'crm_base_url' FROM configuracoes_sistema WHERE chave='central_do_dia'),'https://crm.alliance.com.br'),l.id),
      jsonb_build_object('tipo','prazo_estourado','tarefa_id',v.id,'idempotency_key','prazo:'||v.id::text)
    FROM vencidas v JOIN leads l ON l.id=v.lead_id
    ON CONFLICT DO NOTHING RETURNING 1
  ) SELECT count(*) INTO v_count FROM mensagens;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_ligacao_v2(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION desfazer_ligacao_v2(uuid) TO authenticated;
