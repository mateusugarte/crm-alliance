-- Tabela de etiquetas
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1E90FF',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de junção lead-etiqueta
CREATE TABLE IF NOT EXISTS lead_labels (
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lead_id, label_id)
);

-- RLS
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_labels ENABLE ROW LEVEL SECURITY;

-- Policies: todos autenticados leem, apenas adm cria/deleta etiquetas globais
CREATE POLICY "labels_read" ON labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "labels_insert" ON labels FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "labels_delete" ON labels FOR DELETE TO authenticated USING (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'adm')
);

CREATE POLICY "lead_labels_read" ON lead_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_labels_insert" ON lead_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lead_labels_delete" ON lead_labels FOR DELETE TO authenticated USING (true);
