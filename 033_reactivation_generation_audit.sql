-- Migration 033: rastreabilidade imutável da geração de mensagens de reativação.

BEGIN;

ALTER TABLE public.reactivation_campaigns
  ADD COLUMN IF NOT EXISTS campaign_brief jsonb,
  ADD COLUMN IF NOT EXISTS generation_version text;

CREATE TABLE IF NOT EXISTS public.reactivation_generation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reactivation_campaign_id uuid NOT NULL REFERENCES public.reactivation_campaigns(id) ON DELETE CASCADE,
  reactivation_dispatch_id uuid NOT NULL UNIQUE REFERENCES public.reactivation_dispatches(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  original_message text NOT NULL,
  approved_message text NOT NULL,
  campaign_brief jsonb NOT NULL,
  audience jsonb NOT NULL,
  context_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_plan jsonb NOT NULL,
  context_mode text NOT NULL,
  context_summary text NOT NULL,
  model text,
  prompt_version text NOT NULL,
  resolution text NOT NULL,
  quality_flags text[] NOT NULL DEFAULT '{}',
  manually_edited boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_generation_campaign
  ON public.reactivation_generation_snapshots(reactivation_campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reactivation_generation_lead
  ON public.reactivation_generation_snapshots(lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.reactivation_generation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactivation_generation_snapshots: adm le" ON public.reactivation_generation_snapshots;
CREATE POLICY "reactivation_generation_snapshots: adm le"
  ON public.reactivation_generation_snapshots FOR SELECT
  TO authenticated
  USING (is_adm());

COMMENT ON TABLE public.reactivation_generation_snapshots IS
  'Snapshot de aprovação da mensagem. A aplicação não oferece update ou delete deste registro.';

CREATE OR REPLACE FUNCTION public.inject_reactivation_message(
  p_dispatch_id uuid,
  p_message text,
  p_typing_delay integer,
  p_interval_delay_ms integer,
  p_snapshot jsonb DEFAULT NULL,
  p_approved_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  dispatch_row public.reactivation_dispatches%ROWTYPE;
BEGIN
  SELECT * INTO dispatch_row
    FROM public.reactivation_dispatches
   WHERE id = p_dispatch_id
     AND status = 'pending'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.reactivation_dispatches
     SET message_sent = p_message,
         typing_delay = p_typing_delay,
         interval_delay_ms = p_interval_delay_ms
   WHERE id = p_dispatch_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Não foi possível configurar o dispatch %', p_dispatch_id;
  END IF;

  IF p_snapshot IS NOT NULL THEN
    INSERT INTO public.reactivation_generation_snapshots (
      reactivation_campaign_id,
      reactivation_dispatch_id,
      lead_id,
      original_message,
      approved_message,
      campaign_brief,
      audience,
      context_facts,
      message_plan,
      context_mode,
      context_summary,
      model,
      prompt_version,
      resolution,
      quality_flags,
      manually_edited,
      approved_by
    ) VALUES (
      dispatch_row.reactivation_campaign_id,
      dispatch_row.id,
      dispatch_row.lead_id,
      p_snapshot->>'original_message',
      p_message,
      p_snapshot->'campaign_brief',
      p_snapshot->'audience',
      COALESCE(p_snapshot->'context_facts', '[]'::jsonb),
      p_snapshot->'message_plan',
      p_snapshot->>'context_mode',
      p_snapshot->>'context_summary',
      p_snapshot->>'model',
      p_snapshot->>'prompt_version',
      p_snapshot->>'resolution',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'quality_flags', '[]'::jsonb))),
      COALESCE((p_snapshot->>'manually_edited')::boolean, false),
      p_approved_by
    )
    ON CONFLICT (reactivation_dispatch_id) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.inject_reactivation_message(uuid, text, integer, integer, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inject_reactivation_message(uuid, text, integer, integer, jsonb, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inject_reactivation_message(uuid, text, integer, integer, jsonb, uuid) TO service_role;

COMMIT;
