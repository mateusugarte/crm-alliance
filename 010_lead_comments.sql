CREATE TABLE IF NOT EXISTS lead_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  user_name   text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read lead comments" ON lead_comments;
CREATE POLICY "Authenticated can read lead comments"
  ON lead_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert own comments" ON lead_comments;
CREATE POLICY "Authenticated can insert own comments"
  ON lead_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON lead_comments;
CREATE POLICY "Users can delete own comments"
  ON lead_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lead_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lead_comments;
  END IF;
END $$;
