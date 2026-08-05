-- Migration 031: separa contatos não compradores do funil comercial.
-- A classificação foi revisada contra as conversas reais em 2026-08-05.

BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'leads'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ~* '(^|[^a-z_])stage([^a-z_]|$)'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_check
  CHECK (stage IN (
    'nao_respondeu',
    'fornecedores',
    'lead_frio',
    'lead_morno',
    'lead_quente',
    'follow_up',
    'sem_interesse',
    'reuniao_agendada',
    'visita_confirmada',
    'cliente'
  ));

CREATE TABLE IF NOT EXISTS public.fornecedores_classification_audit (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  audit_source text NOT NULL,
  previous_stage text NOT NULL,
  previous_automation_paused boolean NOT NULL,
  previous_resgate_status text,
  category text NOT NULL CHECK (category IN ('fornecedor', 'parceiro', 'emprego', 'bot_terceiro', 'teste')),
  reason text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, audit_source)
);

COMMENT ON TABLE public.fornecedores_classification_audit IS
  'Snapshot reversível das classificações que retiraram não compradores do funil comercial.';

WITH classifications(lead_id, category, reason) AS (
  VALUES
    ('bdc87666-8afb-4cad-9d68-8119ed33cd77'::uuid, 'fornecedor', 'Oferece produto ou serviço para a empresa'),
    ('4d55ed55-9ac8-4bba-a6ad-304c5db35d50'::uuid, 'fornecedor', 'Oferece brindes personalizados'),
    ('6f6254d6-f7fb-4765-9833-be15116e615b'::uuid, 'fornecedor', 'Oferece papelaria corporativa'),
    ('b5877ac3-adb1-443a-b732-99b0ed7a8911'::uuid, 'parceiro', 'Propõe parceria comercial'),
    ('60d7e502-5f27-4687-b9d1-41dd92a1b46a'::uuid, 'fornecedor', 'Oferece produto ou serviço para a obra'),
    ('6fdfc8f3-0c71-462c-84fc-f1acc36e8598'::uuid, 'bot_terceiro', 'Atendimento automático da ProHair'),
    ('845aefc2-4d6a-41ee-9509-f07646626dbb'::uuid, 'bot_terceiro', 'Atendimento automático da PUCRS'),
    ('54edde68-55d1-4070-9f3a-2e8408a58670'::uuid, 'bot_terceiro', 'Atendimento automático de outra imobiliária'),
    ('57ca45e8-c7dc-4019-981a-3b31ea48b079'::uuid, 'parceiro', 'Oferece terrenos e imóveis para incorporação'),
    ('e39a11f6-d751-4bef-8733-ae78b33c3482'::uuid, 'parceiro', 'Corretor buscando parceria comercial'),
    ('22f63455-1377-481d-aa23-992577aa905d'::uuid, 'bot_terceiro', 'Atendimento automático de concessionária'),
    ('0badb26c-daed-4ee0-a473-5520a745ad40'::uuid, 'bot_terceiro', 'Resposta automática de corretor'),
    ('d26c7f5f-422d-4962-9425-5f8ec71c8ad8'::uuid, 'bot_terceiro', 'Atendimento automático da UNIASSELVI'),
    ('3b7ecbce-3211-47aa-b39b-756f0edf6fd6'::uuid, 'bot_terceiro', 'Atendimento automático da Estácio'),
    ('460a3dee-a475-4ee6-b350-32402a26f849'::uuid, 'fornecedor', 'Oferece serviço de vidraçaria'),
    ('185afd15-ce94-4a48-89cb-5f9248f12b66'::uuid, 'bot_terceiro', 'Atendimento automático da Decolar'),
    ('33c998aa-108f-454e-aba2-ca1f0df55725'::uuid, 'bot_terceiro', 'Atendimento automático de empresa'),
    ('c77fbae8-4763-43dc-9d94-6e0ad62cc2d7'::uuid, 'bot_terceiro', 'Atendimento automático da Estácio'),
    ('5ea897ae-150f-4305-b0bf-cedcdf72023f'::uuid, 'bot_terceiro', 'Canal automático de informações'),
    ('78bd575b-4b66-416a-80ad-3b673f646992'::uuid, 'bot_terceiro', 'Atendimento automático em manutenção'),
    ('b53d8aa4-aa18-48c1-bf68-991ea51f1bf5'::uuid, 'fornecedor', 'Oferece serviço de imagens aéreas com drone'),
    ('70a85aff-334a-4319-b032-26b4a385167c'::uuid, 'bot_terceiro', 'Atendimento automático de consultório'),
    ('095f3afa-b395-43e6-90d0-553deae5fb0e'::uuid, 'parceiro', 'Oferece terreno para incorporação'),
    ('8212bf8c-e068-4da7-a90b-bccd35c65e95'::uuid, 'fornecedor', 'Contato de entrega para a empresa'),
    ('87805c6e-5ca8-484f-9046-92965f5e67a8'::uuid, 'bot_terceiro', 'Atendimento automático de consultório'),
    ('d4eef08e-6169-4316-a824-1a0031188b6a'::uuid, 'emprego', 'Contato procura emprego'),
    ('892388da-5529-4d62-8d55-804559a39546'::uuid, 'emprego', 'Contato procura emprego'),
    ('b4b8133c-bdcc-423a-8b74-1b99737e460b'::uuid, 'teste', 'Contato de teste'),
    ('985ea8b5-35e9-4def-8f1e-059037f7a6aa'::uuid, 'teste', 'Contato de teste'),
    ('7bd80cd9-dae5-431d-85da-f45bab87742c'::uuid, 'teste', 'Contato de teste'),
    ('684f20fa-0f86-4044-a8c0-9ef43a9fe520'::uuid, 'fornecedor', 'Oferece locação de escoramento metálico'),
    ('bf0c8c77-9007-4f14-9d58-20efba273d76'::uuid, 'fornecedor', 'Oferece execução de serviços elétricos e automação'),
    ('521ad58b-8f7c-4cfa-9722-cbe58a967509'::uuid, 'parceiro', 'Corretor quer trabalhar na venda do empreendimento')
), snapshot AS (
  INSERT INTO public.fornecedores_classification_audit (
    lead_id,
    audit_source,
    previous_stage,
    previous_automation_paused,
    previous_resgate_status,
    category,
    reason
  )
  SELECT
    l.id,
    'auditoria_2026_08_05',
    l.stage,
    l.automation_paused,
    l.resgate_status,
    c.category,
    c.reason
  FROM classifications c
  JOIN public.leads l ON l.id = c.lead_id
  ON CONFLICT (lead_id, audit_source) DO NOTHING
  RETURNING lead_id
)
SELECT count(*) FROM snapshot;

SELECT set_config('app.origem', 'auditoria_fornecedores', true);

UPDATE public.leads l
   SET stage = 'fornecedores',
       automation_paused = true,
       resgate_status = 'inelegivel',
       updated_at = now()
  FROM public.fornecedores_classification_audit a
 WHERE a.lead_id = l.id
   AND a.audit_source = 'auditoria_2026_08_05'
   AND l.stage <> 'fornecedores';

UPDATE public.tarefas t
   SET status = 'cancelada',
       observacao = 'Cancelada: contato classificado como fornecedor ou não comprador'
  FROM public.fornecedores_classification_audit a
 WHERE a.lead_id = t.lead_id
   AND a.audit_source = 'auditoria_2026_08_05'
   AND t.status IN ('pendente', 'vencida');

DELETE FROM public.fila_diaria fd
USING public.tarefas t,
      public.fornecedores_classification_audit a
WHERE fd.tarefa_id = t.id
  AND t.lead_id = a.lead_id
  AND a.audit_source = 'auditoria_2026_08_05'
  AND t.status = 'cancelada';

COMMIT;

-- Reversão assistida, se necessária:
-- UPDATE leads l SET stage=a.previous_stage,
--   automation_paused=a.previous_automation_paused,
--   resgate_status=a.previous_resgate_status
-- FROM fornecedores_classification_audit a
-- WHERE a.lead_id=l.id AND a.audit_source='auditoria_2026_08_05';
