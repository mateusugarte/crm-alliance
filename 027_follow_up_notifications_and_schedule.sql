-- Follow-up notifications: immediate qualification alert and a single daily reminder.
-- Depends on migrations 023 through 026. Safe to run more than once.

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

  SELECT
    COALESCE(valor->>'grupo_whatsapp', '120363429109259182@g.us'),
    COALESCE(valor->>'crm_base_url', 'https://crm.alliance.com.br')
  INTO v_group, v_crm_url
  FROM configuracoes_sistema
  WHERE chave='central_do_dia';

  INSERT INTO mensagens_saida (destino, destino_tipo, corpo, contexto)
  VALUES (
    COALESCE(v_group, '120363429109259182@g.us'),
    'grupo',
    format(
      E'*FOLLOW UP PENDENTE*\n\n%s está aguardando ligação.\nQualificada em %s.\n\nAbrir lead:\n%s/kanban?lead=%s',
      NEW.name,
      to_char(NEW.qualificado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      COALESCE(v_crm_url, 'https://crm.alliance.com.br'),
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

-- The immediate alert above and the 08:00 digest are enough. This function
-- now only marks overdue qualification work instead of sending a third alert.
CREATE OR REPLACE FUNCTION verificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  UPDATE tarefas t
  SET status='vencida', escalonada_em=COALESCE(t.escalonada_em, now())
  FROM leads l
  WHERE l.id=t.lead_id
    AND t.origem='qualificacao'
    AND t.status='pendente'
    AND t.vence_em<=now()
    AND l.stage='lead_quente'
    AND l.primeira_ligacao_em IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION verificar_prazos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verificar_prazos() TO service_role;
