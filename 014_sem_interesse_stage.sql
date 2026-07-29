-- Migration 014: adiciona o estágio manual "Sem interesse" ao funil de leads
-- Executar no Supabase SQL Editor

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT c.conname
    INTO existing_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'leads'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%stage%'
  LIMIT 1;

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_check
  CHECK (stage IN (
    'nao_respondeu',
    'lead_frio',
    'lead_morno',
    'lead_quente',
    'follow_up',
    'sem_interesse',
    'reuniao_agendada',
    'visita_confirmada',
    'cliente'
  ));
