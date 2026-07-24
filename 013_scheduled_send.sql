-- Migration 013: horário absoluto de próximo envio
-- Executar no Supabase SQL Editor
--
-- Sem isso, o motor de disparo (src/lib/disparo/engine.ts) só sabe "esperar X ms" em
-- memória (setTimeout). Se o processo reinicia (deploy, crash) no meio dessa espera,
-- o próximo envio sai imediatamente ao subir de novo, encurtando o intervalo configurado
-- na prática (ex: campanha de 10-20 min enviando de 5 em 5 durante uma sequência de deploys).
--
-- Com scheduled_at persistido, a espera vira "quanto falta até este horário absoluto",
-- recalculada a cada vez que o loop roda — reinício no meio da espera já resume certo.

ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE reactivation_dispatches ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
