-- ============================================================
-- 006_vendas.sql
-- Adiciona coluna vendido aos imóveis + tabela de vendas
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Adiciona coluna vendido (default false = não vendido)
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS vendido BOOLEAN NOT NULL DEFAULT false;

-- 2. Tabela de vendas
CREATE TABLE IF NOT EXISTS vendas (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id             TEXT          NOT NULL,
  comprador_nome        TEXT          NOT NULL,
  comprador_telefone    TEXT          NOT NULL,
  comprador_email       TEXT,
  unidade_comprada      TEXT          NOT NULL,
  -- Entrada
  tem_entrada           BOOLEAN       NOT NULL DEFAULT false,
  valor_entrada         NUMERIC,
  -- Financiamento bancário
  tem_financiamento     BOOLEAN       NOT NULL DEFAULT false,
  valor_financiado      NUMERIC,
  parcelas_financiamento INTEGER,
  -- Parcelamento direto com La Reserva
  tem_parcelamento_direto BOOLEAN     NOT NULL DEFAULT false,
  parcelas_direto       INTEGER,
  valor_parcela_direto  NUMERIC,
  -- Metadados
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by            UUID          REFERENCES user_profiles(id)
);

-- 3. RLS
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

-- ADM: acesso total
CREATE POLICY "adm_all_vendas" ON vendas
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'adm'
  ));

-- Corretores: apenas leitura
CREATE POLICY "corretor_select_vendas" ON vendas
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
