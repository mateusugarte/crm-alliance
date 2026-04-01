-- Adiciona colunas de pavimento e cobertura à tabela imoveis
-- Obs: coluna 'pavimento' já foi criada manualmente pelo usuário

-- Adiciona cobertura (boolean) e numero_unidade (1-4 regular, 1-2 cobertura)
ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS cobertura BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS numero_unidade SMALLINT NOT NULL DEFAULT 1;

-- Garante que pavimento existe com tipo correto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imoveis' AND column_name = 'pavimento'
  ) THEN
    ALTER TABLE imoveis ADD COLUMN pavimento SMALLINT NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Constraints de validação
ALTER TABLE imoveis
  DROP CONSTRAINT IF EXISTS imoveis_pavimento_check,
  DROP CONSTRAINT IF EXISTS imoveis_numero_unidade_check;

ALTER TABLE imoveis
  ADD CONSTRAINT imoveis_pavimento_check CHECK (pavimento BETWEEN 1 AND 9),
  ADD CONSTRAINT imoveis_numero_unidade_check CHECK (numero_unidade BETWEEN 1 AND 4);

-- Corrige o nome de todos os imóveis com base em pavimento + numero_unidade
-- (necessário pois o formulário pode ter sobrescrito os nomes com defaults 1/1)
UPDATE imoveis SET nome =
  CASE
    WHEN pavimento = 9 THEN 'COB ' || numero_unidade::text
    ELSE 'Apto 0' || numero_unidade::text
  END;

-- ATENÇÃO: após rodar esta migration, abra cada imóvel no sistema
-- e selecione o pavimento e unidade corretos para cada um.
