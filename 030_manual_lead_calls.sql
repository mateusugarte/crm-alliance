-- Permite registrar uma ligacao a partir do painel do lead, reutilizando toda
-- a regra transacional da Central do Dia.

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

  -- Serializa registros manuais do mesmo lead e evita duas tarefas criadas
  -- por cliques simultaneos.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_lead_id::text, 301));

  SELECT * INTO v_tarefa
  FROM tarefas
  WHERE lead_id=p_lead_id AND status IN ('pendente','vencida')
  ORDER BY (responsavel_id=auth.uid()) DESC, vence_em, criada_em
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_tarefa.responsavel_id <> auth.uid() AND NOT is_adm() THEN
    RAISE EXCEPTION 'Este follow up esta atribuido a outro usuario';
  END IF;

  IF NOT FOUND THEN
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

REVOKE ALL ON FUNCTION registrar_ligacao_lead_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_ligacao_lead_v1(uuid,ligacao_desfecho,text,timestamptz,boolean,text) TO authenticated;
