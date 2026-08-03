-- 015_admin_login_logs.sql
-- Estrutura para auditoria de acessos ADM e painel de Configuracoes.

CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'corretor'
                CHECK (role IN ('adm', 'corretor')),
  source      TEXT NOT NULL DEFAULT 'password_login',
  ip_address  TEXT,
  user_agent  TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_logged_at
  ON login_logs(user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_logged_at
  ON login_logs(logged_at DESC);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_logs: usuario registra proprio login" ON login_logs;
CREATE POLICY "login_logs: usuario registra proprio login"
  ON login_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "login_logs: ADM le tudo" ON login_logs;
CREATE POLICY "login_logs: ADM le tudo"
  ON login_logs FOR SELECT
  TO authenticated
  USING (is_adm());

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
    COUNT(l.id) AS login_count,
    COUNT(l.id) FILTER (WHERE l.logged_at >= now() - interval '7 days') AS login_count_7d,
    COUNT(l.id) FILTER (WHERE l.logged_at >= now() - interval '30 days') AS login_count_30d
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

-- Backfill inicial: nao reconstrui historico, apenas importa o ultimo login conhecido.
INSERT INTO login_logs (user_id, email, full_name, role, source, logged_at)
SELECT
  u.id,
  u.email,
  p.full_name,
  COALESCE(p.role, 'corretor'),
  'backfill_last_sign_in',
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.last_sign_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.login_logs l
    WHERE l.user_id = u.id
      AND l.source = 'backfill_last_sign_in'
  );

-- Acesso master solicitado.
UPDATE user_profiles
SET role = 'adm'
WHERE id IN (
  SELECT id
  FROM auth.users
  WHERE email IN ('marco@alliance.com.br', 'adm@alliance.com.br')
);

