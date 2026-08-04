\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  resultado timestamptz;
BEGIN
  resultado := calcula_prazo('2026-08-07 16:00:00-03');
  IF resultado <> '2026-08-10 12:00:00-03'::timestamptz THEN
    RAISE EXCEPTION 'sexta 16h: esperado 10/08 12h, recebido %', resultado;
  END IF;

  resultado := calcula_prazo('2026-08-08 10:00:00-03');
  IF resultado <> '2026-08-10 12:00:00-03'::timestamptz THEN
    RAISE EXCEPTION 'sabado: esperado 10/08 12h, recebido %', resultado;
  END IF;

  resultado := calcula_prazo('2026-08-09 10:00:00-03');
  IF resultado <> '2026-08-11 08:00:00-03'::timestamptz THEN
    RAISE EXCEPTION 'domingo: esperado 11/08 08h, recebido %', resultado;
  END IF;

  resultado := calcula_prazo('2026-08-10 14:00:00-03');
  IF resultado <> '2026-08-12 08:00:00-03'::timestamptz THEN
    RAISE EXCEPTION 'madrugada: esperado 12/08 08h, recebido %', resultado;
  END IF;

  INSERT INTO feriados (data, descricao)
  VALUES ('2026-08-12', 'Feriado de teste')
  ON CONFLICT (data) DO UPDATE SET descricao = EXCLUDED.descricao;

  resultado := calcula_prazo('2026-08-10 14:00:00-03');
  IF resultado <> '2026-08-13 12:00:00-03'::timestamptz THEN
    RAISE EXCEPTION 'feriado: esperado 13/08 12h, recebido %', resultado;
  END IF;
END;
$$;

ROLLBACK;

SELECT 'Central do Dia: regras de prazo validadas' AS resultado;
