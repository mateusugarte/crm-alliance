-- 016_session_visit_logs.sql
-- Conta acesso diario mesmo quando o usuario entra com sessao/cookie ja salvo.

ALTER TABLE login_logs
  ADD COLUMN IF NOT EXISTS logged_date DATE;

UPDATE login_logs
SET logged_date = (logged_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE logged_date IS NULL;

ALTER TABLE login_logs
  ALTER COLUMN logged_date SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  ALTER COLUMN logged_date SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_login_logs_session_visit_daily
  ON login_logs(user_id, source, logged_date)
  WHERE source = 'session_visit';

CREATE OR REPLACE FUNCTION record_user_access_event(
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
  v_logged_date DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user.id;

  INSERT INTO public.login_logs (
    user_id,
    email,
    full_name,
    role,
    source,
    ip_address,
    user_agent,
    logged_date
  )
  VALUES (
    v_user.id,
    v_user.email,
    v_profile.full_name,
    COALESCE(v_profile.role, 'corretor'),
    'session_visit',
    p_ip_address,
    p_user_agent,
    v_logged_date
  )
  ON CONFLICT (user_id, source, logged_date)
  WHERE source = 'session_visit'
  DO UPDATE SET
    logged_at = now(),
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    ip_address = COALESCE(EXCLUDED.ip_address, public.login_logs.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.login_logs.user_agent);
END;
$$;

GRANT EXECUTE ON FUNCTION record_user_access_event(TEXT, TEXT) TO authenticated;

-- Backfill da melhor estimativa historica de "entrou ja logado".
-- auth.sessions.updated_at pode ser refresh de sessao, mas e melhor que last_sign_in_at
-- para estimar acesso antigo quando o usuario nao digitou senha novamente.
WITH last_session_update AS (
  SELECT
    s.user_id,
    MAX(s.updated_at) AS updated_at
  FROM auth.sessions s
  GROUP BY s.user_id
)
INSERT INTO login_logs (user_id, email, full_name, role, source, logged_at, logged_date)
SELECT
  u.id,
  u.email,
  p.full_name,
  COALESCE(p.role, 'corretor'),
  'backfill_session_updated',
  lsu.updated_at,
  (lsu.updated_at AT TIME ZONE 'America/Sao_Paulo')::date
FROM last_session_update lsu
JOIN auth.users u ON u.id = lsu.user_id
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE lsu.updated_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.login_logs l
    WHERE l.user_id = u.id
      AND l.source = 'backfill_session_updated'
  );

CREATE OR REPLACE FUNCTION list_user_access_overview()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  badge_color TEXT,
  created_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count BIGINT,
  login_count_7d BIGINT,
  login_count_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_adm() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.full_name::TEXT,
    p.role::TEXT,
    p.badge_color::TEXT,
    u.created_at,
    u.confirmed_at,
    u.last_sign_in_at,
    MAX(l.logged_at) AS last_login_at,
    COUNT(DISTINCT l.logged_date) AS login_count,
    COUNT(DISTINCT l.logged_date) FILTER (WHERE l.logged_at >= now() - interval '7 days') AS login_count_7d,
    COUNT(DISTINCT l.logged_date) FILTER (WHERE l.logged_at >= now() - interval '30 days') AS login_count_30d
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.login_logs l ON l.user_id = u.id
  GROUP BY
    u.id,
    u.email,
    p.full_name,
    p.role,
    p.badge_color,
    u.created_at,
    u.confirmed_at,
    u.last_sign_in_at
  ORDER BY COALESCE(MAX(l.logged_at), u.last_sign_in_at, u.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_user_access_overview() TO authenticated;
