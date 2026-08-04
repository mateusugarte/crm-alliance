-- Emergency rollback for 027_follow_up_notifications_and_schedule.sql.
-- Reinstates the notification behavior from migrations 025 and 026 without
-- removing additive tables or data used by older application versions.

BEGIN;

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

CREATE OR REPLACE FUNCTION verificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0; v_group text;
BEGIN
  SELECT valor->>'grupo_whatsapp' INTO v_group
  FROM configuracoes_sistema
  WHERE chave='central_do_dia';

  WITH vencidas AS (
    UPDATE tarefas t SET status='vencida', escalonada_em=now()
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

REVOKE ALL ON FUNCTION verificar_prazos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verificar_prazos() TO service_role;

COMMIT;
