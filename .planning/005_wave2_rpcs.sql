-- ═══════════════════════════════════════════════════════════
-- Migration 005 — Wave 2: RPCs atômicas, meetings.title,
--                         lead_read_state, trigger user_profiles
-- Executar no Supabase SQL Editor (pode rodar múltiplas vezes)
-- ═══════════════════════════════════════════════════════════

-- ── 1. meetings.title ─────────────────────────────────────
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS title TEXT;

-- ── 2. lead_read_state ────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_read_state (
  lead_id      UUID NOT NULL REFERENCES leads(id)      ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, user_id)
);

ALTER TABLE lead_read_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_read_state_own" ON lead_read_state;
CREATE POLICY "lead_read_state_own"
  ON lead_read_state
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lead_read_state_service" ON lead_read_state;
CREATE POLICY "lead_read_state_service"
  ON lead_read_state
  FOR ALL
  TO service_role
  USING (true);

-- ── 3. Trigger: criar user_profile no signup ──────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role, badge_color)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'corretor',
    '#6366f1'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 4. RPC: increment_interaction_count ───────────────────
CREATE OR REPLACE FUNCTION increment_interaction_count(lead_uuid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE leads
  SET interaction_count = interaction_count + 1,
      updated_at = now()
  WHERE id = lead_uuid;
$$;

-- ── 5. RPC: toggle_automation_pause ───────────────────────
CREATE OR REPLACE FUNCTION toggle_automation_pause(lead_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_state BOOLEAN;
BEGIN
  UPDATE leads
  SET automation_paused = NOT automation_paused,
      updated_at = now()
  WHERE id = lead_uuid
  RETURNING automation_paused INTO new_state;
  RETURN new_state;
END;
$$;

-- ── 6. RPC: move_lead_stage ───────────────────────────────
CREATE OR REPLACE FUNCTION move_lead_stage(
  lead_uuid UUID,
  new_stage  TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE leads
  SET stage = new_stage::text,
      updated_at = now()
  WHERE id = lead_uuid;
$$;

-- ── 7. RPC: toggle_imovel_disponivel ──────────────────────
CREATE OR REPLACE FUNCTION toggle_imovel_disponivel(imovel_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_state BOOLEAN;
BEGIN
  UPDATE imoveis
  SET disponivel = NOT disponivel
  WHERE id = imovel_uuid
  RETURNING disponivel INTO new_state;
  RETURN new_state;
END;
$$;

-- ── 8. RPC: mark_lead_read ────────────────────────────────
CREATE OR REPLACE FUNCTION mark_lead_read(lead_uuid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO lead_read_state (lead_id, user_id, last_read_at)
  VALUES (lead_uuid, auth.uid(), now())
  ON CONFLICT (lead_id, user_id)
  DO UPDATE SET last_read_at = now();
$$;
