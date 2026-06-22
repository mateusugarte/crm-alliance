-- Adiciona coluna para identificar leads contatados via campanha de disparo
ALTER TABLE leads ADD COLUMN IF NOT EXISTS via_disparo boolean DEFAULT false;
