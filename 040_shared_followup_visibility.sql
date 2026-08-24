-- Follow-ups are team-visible and may be completed by any authenticated user.
-- The task keeps an owner while pending; completing it transfers ownership to
-- the user who actually registered the call, preserving accountability.

DROP POLICY IF EXISTS "tarefas: responsavel ou adm le" ON tarefas;
DROP POLICY IF EXISTS "tarefas: equipe le" ON tarefas;
CREATE POLICY "tarefas: equipe le" ON tarefas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fila: responsavel ou adm le" ON fila_diaria;
DROP POLICY IF EXISTS "fila: equipe le" ON fila_diaria;
CREATE POLICY "fila: equipe le" ON fila_diaria
  FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_ligacao_equipe_v1(
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;

  UPDATE tarefas
  SET responsavel_id=auth.uid()
  WHERE id=p_tarefa_id AND status IN ('pendente','vencida');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta tarefa ja foi concluida, cancelada ou nao existe';
  END IF;

  RETURN registrar_ligacao_v2(
    p_tarefa_id,p_desfecho,p_observacao,p_retorno_em,p_marcou_reuniao,p_motivo_perda
  );
END;
$$;

CREATE OR REPLACE FUNCTION registrar_ligacao_lead_v1(
  p_lead_id uuid,
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id=p_lead_id) THEN
    RAISE EXCEPTION 'Lead nao encontrado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_lead_id::text, 301));

  SELECT * INTO v_tarefa
  FROM tarefas
  WHERE lead_id=p_lead_id AND status IN ('pendente','vencida')
  ORDER BY (responsavel_id=auth.uid()) DESC, vence_em, criada_em
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE tarefas SET responsavel_id=auth.uid()
    WHERE id=v_tarefa.id
    RETURNING * INTO v_tarefa;
  ELSE
    INSERT INTO tarefas (lead_id,responsavel_id,origem,tentativa_num,vence_em,status)
    SELECT p_lead_id,auth.uid(),'manual',COALESCE(tentativas_ligacao,0)+1,now(),'pendente'
    FROM leads WHERE id=p_lead_id
    RETURNING * INTO v_tarefa;
  END IF;

  RETURN registrar_ligacao_v2(
    v_tarefa.id,p_desfecho,p_observacao,p_retorno_em,p_marcou_reuniao,p_motivo_perda
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_ligacao_equipe_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_ligacao_equipe_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;

REVOKE ALL ON FUNCTION registrar_ligacao_lead_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_ligacao_lead_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;
