-- 020_lead_score.sql
-- Score comercial explicavel para priorizacao de leads.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score_band TEXT NOT NULL DEFAULT 'muito_frio',
  ADD COLUMN IF NOT EXISTS lead_score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_lead_score_range_check'
      AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_lead_score_range_check
      CHECK (lead_score >= 0 AND lead_score <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_lead_score
  ON leads(lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_leads_lead_score_band
  ON leads(lead_score_band);

CREATE OR REPLACE FUNCTION lead_score_band_from_score(p_score INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score >= 85 THEN 'prioridade'
    WHEN p_score >= 65 THEN 'quente'
    WHEN p_score >= 40 THEN 'morno'
    WHEN p_score >= 20 THEN 'frio'
    ELSE 'muito_frio'
  END;
$$;

CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id UUID)
RETURNS TABLE(score INTEGER, score_10 NUMERIC, band TEXT, reasons JSONB)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  l leads%ROWTYPE;
  v_score INTEGER := 0;
  v_pipeline_score INTEGER := 0;
  v_fit_score INTEGER := 0;
  v_intent_score INTEGER := 0;
  v_engagement_score INTEGER := 0;
  v_disparo_score INTEGER := 0;
  v_penalty INTEGER := 0;
  v_reasons JSONB := '[]'::jsonb;
  v_inbound_count INTEGER := 0;
  v_latest_inbound TIMESTAMPTZ;
  v_days_since_inbound INTEGER;
  v_inbound_text TEXT := '';
  v_context_text TEXT := '';
  v_has_price_signal BOOLEAN := false;
  v_has_specific_signal BOOLEAN := false;
  v_has_advanced_signal BOOLEAN := false;
  v_has_generic_detail_signal BOOLEAN := false;
  v_has_negative_signal BOOLEAN := false;
  v_has_non_human_signal BOOLEAN := false;
  v_responded_to_disparo BOOLEAN := false;
  v_advanced_after_disparo BOOLEAN := false;
BEGIN
  SELECT * INTO l
  FROM leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF l.stage = 'sem_interesse' THEN
    score := 0;
    score_10 := 0.0;
    band := lead_score_band_from_score(0);
    reasons := jsonb_build_array(
      jsonb_build_object(
        'group', 'pipeline',
        'points', 0,
        'label', 'Lead marcado como sem interesse'
      )
    );
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    MAX(created_at)
  INTO v_inbound_count, v_latest_inbound
  FROM interactions
  WHERE lead_id = p_lead_id
    AND direction = 'inbound';

  IF v_latest_inbound IS NOT NULL THEN
    v_days_since_inbound := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - v_latest_inbound)) / 86400)::INTEGER);
  END IF;

  SELECT COALESCE(string_agg(content, ' ' ORDER BY created_at DESC), '')
  INTO v_inbound_text
  FROM (
    SELECT content, created_at
    FROM interactions
    WHERE lead_id = p_lead_id
      AND direction = 'inbound'
    ORDER BY created_at DESC
    LIMIT 30
  ) recent_interactions;

  v_inbound_text := lower(v_inbound_text);
  v_context_text := lower(concat_ws(' ', v_inbound_text, l.summary, l.intention, l.imovel_interesse, l.city));

  v_has_price_signal := v_inbound_count > 0 AND v_context_text LIKE ANY (ARRAY[
    '%valor%', '%preço%', '%preco%', '%condição%', '%condicao%', '%entrada%',
    '%parcela%', '%financia%', '%tabela%', '%pagamento%', '%quanto custa%'
  ]);

  v_has_specific_signal := v_inbound_count > 0 AND v_context_text LIKE ANY (ARRAY[
    '%unidade%', '%apartamento%', '%apto%', '%cobertura%', '%metragem%',
    '%metros%', '%quarto%', '%suíte%', '%suite%', '%localização%', '%localizacao%',
    '%endereço%', '%endereco%', '%obra%', '%entrega%', '%fase%', '%disponibilidade%',
    '%opções%', '%opcoes%', '%opção%', '%opcao%', '%planta%', '%andar%', '%reserva%'
  ]);

  v_has_advanced_signal := v_inbound_count > 0 AND v_context_text LIKE ANY (ARRAY[
    '%proposta%', '%simulação%', '%simulacao%', '%simular%', '%visita%',
    '%reunião%', '%reuniao%', '%ligação%', '%ligacao%', '%consultor%',
    '%corretor%', '%me liga%', '%pode chamar%', '%quero avançar%', '%quero avancar%'
  ]);

  v_has_generic_detail_signal := v_inbound_count > 0 AND v_context_text LIKE ANY (ARRAY[
    '%detalhe%', '%informação%', '%informacao%', '%me manda%', '%manda mais%',
    '%catálogo%', '%catalogo%', '%pdf%', '%material%'
  ]);

  v_has_negative_signal := v_inbound_text ~
    '(sem interesse|n(a|ã)o tenho interesse|n(a|ã)o tenho condi(c|ç)(a|ã)o|n(a|ã)o tenho condi(c|ç)(o|õ)es|sem chance|n(a|ã)o cabe|n(a|ã)o consigo comprar|mais barato|remover|descadastrar|^pare[.! ]|[.!? ]pare[.!? ]|n(a|ã)o quero($|[.!?]|\\s+(comprar|seguir|continuar|investir|morar|apartamento|im(o|ó)vel)))';

  v_has_non_human_signal := v_context_text LIKE ANY (ARRAY[
    '%assistente virtual%', '%inteligência artificial%', '%inteligencia artificial%',
    '%sou uma ia%', '%sou um ia%', '%sou a sofia%', '%uniaselvi%', '%uniasselvi%',
    '%medsênior%', '%medsenior%', '%sou fornecedor%', '%fornecedor%',
    '%endereço de entrega%', '%endereco de entrega%', '%compra realizada%',
    '%papelaria%', '%energia solar%', '%kit banana%', '%escoramento%',
    '%equipe de engenharia%', '%locação%', '%locacao%', '%imobiliária%', '%imobiliaria%'
  ]);

  v_pipeline_score := CASE l.stage
    WHEN 'nao_respondeu' THEN 3
    WHEN 'lead_frio' THEN 8
    WHEN 'lead_morno' THEN 14
    WHEN 'lead_quente' THEN 20
    WHEN 'reuniao_agendada' THEN 23
    WHEN 'follow_up' THEN 22
    WHEN 'visita_confirmada' THEN 25
    WHEN 'cliente' THEN 25
    ELSE 8
  END;

  IF l.aceitou_consultor IS TRUE THEN
    v_pipeline_score := LEAST(25, v_pipeline_score + 5);
  END IF;

  v_score := v_score + v_pipeline_score;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
    'group', 'pipeline',
    'points', v_pipeline_score,
    'label', CASE
      WHEN l.aceitou_consultor IS TRUE THEN 'Estagio comercial e aceite de consultor'
      ELSE 'Estagio atual do pipeline'
    END
  ));

  IF v_inbound_count > 0 AND l.intention IS NOT NULL THEN
    v_fit_score := v_fit_score + 8;
  END IF;
  IF v_inbound_count > 0 AND NULLIF(btrim(COALESCE(l.imovel_interesse, '')), '') IS NOT NULL THEN
    v_fit_score := v_fit_score + 8;
  END IF;
  IF v_inbound_count > 0 AND NULLIF(btrim(COALESCE(l.city, '')), '') IS NOT NULL THEN
    v_fit_score := v_fit_score + 4;
  END IF;

  IF v_fit_score > 0 THEN
    v_score := v_score + v_fit_score;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'group', 'fit',
      'points', v_fit_score,
      'label', 'Dados de perfil e preferencia preenchidos'
    ));
  END IF;

  IF v_has_price_signal THEN
    v_intent_score := v_intent_score + 12;
  END IF;
  IF v_has_specific_signal THEN
    v_intent_score := v_intent_score + 8;
  END IF;
  IF v_has_advanced_signal THEN
    v_intent_score := v_intent_score + 10;
  END IF;
  IF v_has_generic_detail_signal THEN
    v_intent_score := v_intent_score + 5;
  END IF;
  v_intent_score := LEAST(30, v_intent_score);

  IF v_intent_score > 0 THEN
    v_score := v_score + v_intent_score;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'group', 'intent',
      'points', v_intent_score,
      'label', 'Sinais de interesse identificados na conversa'
    ));
  END IF;

  v_engagement_score := CASE
    WHEN v_inbound_count >= 4 THEN 10
    WHEN v_inbound_count >= 2 THEN 7
    WHEN v_inbound_count = 1 THEN 4
    ELSE 0
  END;

  IF v_latest_inbound IS NOT NULL THEN
    v_engagement_score := v_engagement_score + CASE
      WHEN v_days_since_inbound <= 7 THEN 10
      WHEN v_days_since_inbound <= 30 THEN 7
      WHEN v_days_since_inbound <= 90 THEN 4
      ELSE 1
    END;
  END IF;
  v_engagement_score := LEAST(20, v_engagement_score);

  IF v_engagement_score > 0 THEN
    v_score := v_score + v_engagement_score;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'group', 'engagement',
      'points', v_engagement_score,
      'label', 'Quantidade e recencia das respostas'
    ));
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM disparo_lead_snapshots
      WHERE lead_id = p_lead_id
        AND responded_at IS NOT NULL
    ),
    EXISTS (
      SELECT 1
      FROM disparo_lead_snapshots
      WHERE lead_id = p_lead_id
        AND advanced_at IS NOT NULL
    )
  INTO v_responded_to_disparo, v_advanced_after_disparo;

  IF v_responded_to_disparo THEN
    v_disparo_score := v_disparo_score + 2;
  END IF;
  IF v_advanced_after_disparo THEN
    v_disparo_score := v_disparo_score + 3;
  END IF;

  IF v_disparo_score > 0 THEN
    v_score := v_score + v_disparo_score;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'group', 'disparo',
      'points', v_disparo_score,
      'label', 'Respondeu ou avancou depois de disparo'
    ));
  END IF;

  IF v_has_non_human_signal THEN
    v_penalty := v_penalty + 60;
  END IF;

  IF v_has_negative_signal THEN
    v_penalty := v_penalty + 45;
  END IF;

  IF v_latest_inbound IS NULL AND l.stage IN ('nao_respondeu', 'lead_frio', 'lead_morno', 'lead_quente') THEN
    v_penalty := v_penalty + 25;
  ELSIF v_days_since_inbound > 180 THEN
    v_penalty := v_penalty + 15;
  ELSIF v_days_since_inbound > 90 THEN
    v_penalty := v_penalty + 10;
  ELSIF v_days_since_inbound > 60 THEN
    v_penalty := v_penalty + 5;
  END IF;

  IF COALESCE(l.reactivation_count, 0) >= 4 AND NOT v_responded_to_disparo THEN
    v_penalty := v_penalty + 10;
  ELSIF COALESCE(l.reactivation_count, 0) >= 2 AND NOT v_responded_to_disparo THEN
    v_penalty := v_penalty + 5;
  END IF;

  IF v_penalty > 0 THEN
    v_score := v_score - v_penalty;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'group', 'penalty',
      'points', -v_penalty,
      'label', 'Penalidades por desinteresse, baixa resposta ou lead antigo'
    ));
  END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  IF v_has_non_human_signal THEN
    v_score := LEAST(v_score, 10);
  ELSIF v_inbound_count = 0 AND l.stage IN ('nao_respondeu', 'lead_frio', 'lead_morno', 'lead_quente') THEN
    v_score := LEAST(v_score, 19);
  ELSIF v_has_negative_signal AND l.stage IN ('nao_respondeu', 'lead_frio', 'lead_morno') THEN
    v_score := LEAST(v_score, 19);
  END IF;

  score := v_score;
  score_10 := ROUND((v_score::NUMERIC / 10), 1);
  band := lead_score_band_from_score(v_score);
  reasons := v_reasons;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_lead_score(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE leads l
  SET
    lead_score = c.score,
    lead_score_band = c.band,
    lead_score_reasons = c.reasons,
    lead_score_updated_at = now()
  FROM calculate_lead_score(p_lead_id) c
  WHERE l.id = p_lead_id
    AND (
      l.lead_score IS DISTINCT FROM c.score
      OR l.lead_score_band IS DISTINCT FROM c.band
      OR l.lead_score_reasons IS DISTINCT FROM c.reasons
      OR l.lead_score_updated_at IS NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION refresh_lead_score_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_lead_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lead_refresh_score ON leads;
CREATE TRIGGER on_lead_refresh_score
AFTER INSERT OR UPDATE OF stage, city, intention, imovel_interesse, summary, aceitou_consultor, reactivation_count, last_reactivated_at, via_disparo, pdf_enviado
ON leads
FOR EACH ROW
EXECUTE FUNCTION refresh_lead_score_from_lead();

CREATE OR REPLACE FUNCTION refresh_lead_score_from_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_lead_score(NEW.lead_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_interaction_refresh_lead_score ON interactions;
CREATE TRIGGER on_interaction_refresh_lead_score
AFTER INSERT
ON interactions
FOR EACH ROW
EXECUTE FUNCTION refresh_lead_score_from_interaction();

CREATE OR REPLACE FUNCTION refresh_lead_score_from_disparo_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.lead_id IS NOT NULL AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
    PERFORM refresh_lead_score(OLD.lead_id);
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    PERFORM refresh_lead_score(NEW.lead_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_disparo_snapshot_refresh_lead_score ON disparo_lead_snapshots;
CREATE TRIGGER on_disparo_snapshot_refresh_lead_score
AFTER INSERT OR UPDATE OF lead_id, responded_at, advanced_at
ON disparo_lead_snapshots
FOR EACH ROW
EXECUTE FUNCTION refresh_lead_score_from_disparo_snapshot();

UPDATE leads l
SET
  lead_score = c.score,
  lead_score_band = c.band,
  lead_score_reasons = c.reasons,
  lead_score_updated_at = now()
FROM (
  SELECT l2.id, c.score, c.band, c.reasons
  FROM leads l2
  CROSS JOIN LATERAL calculate_lead_score(l2.id) c
) c
WHERE l.id = c.id
  AND (
    l.lead_score IS DISTINCT FROM c.score
    OR l.lead_score_band IS DISTINCT FROM c.band
    OR l.lead_score_reasons IS DISTINCT FROM c.reasons
    OR l.lead_score_updated_at IS NULL
  );
