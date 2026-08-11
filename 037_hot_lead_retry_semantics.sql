-- Retentativa is reserved for leads that are currently hot. Daily resgates
-- have their own backlog semantics and must never be mixed with retries.

CREATE OR REPLACE FUNCTION enforce_hot_lead_retry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pendente','vencida') AND NOT EXISTS (
    SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.stage='lead_quente'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefas_retentativa_hot_insert ON tarefas;
CREATE TRIGGER tarefas_retentativa_hot_insert
BEFORE INSERT ON tarefas
FOR EACH ROW
WHEN (NEW.origem='retentativa')
EXECUTE FUNCTION enforce_hot_lead_retry();

DROP TRIGGER IF EXISTS tarefas_retentativa_hot_update ON tarefas;
CREATE TRIGGER tarefas_retentativa_hot_update
BEFORE UPDATE OF lead_id,origem,status ON tarefas
FOR EACH ROW
WHEN (NEW.origem='retentativa')
EXECUTE FUNCTION enforce_hot_lead_retry();

CREATE OR REPLACE FUNCTION cancel_retry_when_lead_leaves_hot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage <> 'lead_quente' THEN
    UPDATE tarefas
    SET status='cancelada',
        observacao=COALESCE(observacao,'Retentativa cancelada: lead nao esta mais quente')
    WHERE lead_id=NEW.id
      AND origem='retentativa'
      AND status IN ('pendente','vencida');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_cancel_retry_outside_hot ON leads;
CREATE TRIGGER leads_cancel_retry_outside_hot
AFTER UPDATE OF stage ON leads
FOR EACH ROW
WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
EXECUTE FUNCTION cancel_retry_when_lead_leaves_hot();

UPDATE tarefas t
SET status='cancelada',
    observacao=COALESCE(t.observacao,'Retentativa cancelada: lead nao esta mais quente')
FROM leads l
WHERE l.id=t.lead_id
  AND t.origem='retentativa'
  AND t.status IN ('pendente','vencida')
  AND l.stage<>'lead_quente';
