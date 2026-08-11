-- Preserve both ends of a daily authenticated session. Previously the daily
-- upsert replaced logged_at on every visit, erasing the first access time.

ALTER TABLE login_logs
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

UPDATE login_logs
SET first_seen_at=COALESCE(first_seen_at,logged_at),
    last_seen_at=COALESCE(last_seen_at,logged_at)
WHERE first_seen_at IS NULL OR last_seen_at IS NULL;

ALTER TABLE login_logs
  ALTER COLUMN first_seen_at SET DEFAULT now(),
  ALTER COLUMN first_seen_at SET NOT NULL,
  ALTER COLUMN last_seen_at SET DEFAULT now(),
  ALTER COLUMN last_seen_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_login_logs_last_seen
  ON login_logs(last_seen_at DESC);

CREATE OR REPLACE FUNCTION record_user_access_event(
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
  v_logged_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id=auth.uid();
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id=v_user.id;

  INSERT INTO public.login_logs (
    user_id,email,full_name,role,source,ip_address,user_agent,logged_at,
    logged_date,first_seen_at,last_seen_at
  ) VALUES (
    v_user.id,v_user.email,v_profile.full_name,COALESCE(v_profile.role,'corretor'),
    'session_visit',p_ip_address,p_user_agent,now(),v_logged_date,now(),now()
  )
  ON CONFLICT (user_id,source,logged_date)
  WHERE source='session_visit'
  DO UPDATE SET
    email=EXCLUDED.email,
    full_name=EXCLUDED.full_name,
    role=EXCLUDED.role,
    ip_address=COALESCE(EXCLUDED.ip_address,public.login_logs.ip_address),
    user_agent=COALESCE(EXCLUDED.user_agent,public.login_logs.user_agent),
    first_seen_at=LEAST(public.login_logs.first_seen_at,EXCLUDED.first_seen_at),
    last_seen_at=GREATEST(public.login_logs.last_seen_at,EXCLUDED.last_seen_at),
    logged_at=LEAST(public.login_logs.logged_at,EXCLUDED.logged_at);
END;
$$;

GRANT EXECUTE ON FUNCTION record_user_access_event(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION list_user_access_overview()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  badge_color text,
  created_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  last_login_at timestamptz,
  login_count bigint,
  login_count_7d bigint,
  login_count_30d bigint
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
    u.id,u.email::text,p.full_name::text,p.role::text,p.badge_color::text,
    u.created_at,u.confirmed_at,u.last_sign_in_at,
    MAX(COALESCE(l.last_seen_at,l.logged_at)) AS last_login_at,
    COUNT(DISTINCT l.logged_date) AS login_count,
    COUNT(DISTINCT l.logged_date) FILTER (
      WHERE COALESCE(l.last_seen_at,l.logged_at) >= now()-interval '7 days'
    ) AS login_count_7d,
    COUNT(DISTINCT l.logged_date) FILTER (
      WHERE COALESCE(l.last_seen_at,l.logged_at) >= now()-interval '30 days'
    ) AS login_count_30d
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id=u.id
  LEFT JOIN public.login_logs l ON l.user_id=u.id
  GROUP BY u.id,u.email,p.full_name,p.role,p.badge_color,u.created_at,u.confirmed_at,u.last_sign_in_at
  ORDER BY COALESCE(MAX(COALESCE(l.last_seen_at,l.logged_at)),u.last_sign_in_at,u.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_user_access_overview() TO authenticated;
