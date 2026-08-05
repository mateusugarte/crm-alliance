-- Migration 032: segunda passada da auditoria de não compradores.
-- Dois números comerciais foram confirmados pelas respostas automáticas.

BEGIN;

WITH classifications(lead_id, category, reason) AS (
  VALUES
    ('6dae6425-1d8b-480c-8bcf-cd9dbfe71402'::uuid, 'bot_terceiro', 'Resposta automática de canal comercial indisponível'),
    ('836ce42f-bc43-4037-ba4e-71a8ba182f19'::uuid, 'bot_terceiro', 'Resposta automática de barbearia com troca de número')
)
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
  'auditoria_2026_08_05_segunda_passada',
  l.stage,
  l.automation_paused,
  l.resgate_status,
  c.category,
  c.reason
FROM classifications c
JOIN public.leads l ON l.id = c.lead_id
ON CONFLICT (lead_id, audit_source) DO NOTHING;

SELECT set_config('app.origem', 'auditoria_fornecedores', true);

UPDATE public.leads l
   SET stage = 'fornecedores',
       automation_paused = true,
       resgate_status = 'inelegivel',
       updated_at = now()
  FROM public.fornecedores_classification_audit a
 WHERE a.lead_id = l.id
   AND a.audit_source = 'auditoria_2026_08_05_segunda_passada'
   AND l.stage <> 'fornecedores';

UPDATE public.tarefas t
   SET status = 'cancelada',
       observacao = 'Cancelada: contato classificado como fornecedor ou não comprador'
  FROM public.fornecedores_classification_audit a
 WHERE a.lead_id = t.lead_id
   AND a.audit_source = 'auditoria_2026_08_05_segunda_passada'
   AND t.status IN ('pendente', 'vencida');

DELETE FROM public.fila_diaria fd
USING public.tarefas t,
      public.fornecedores_classification_audit a
WHERE fd.tarefa_id = t.id
  AND t.lead_id = a.lead_id
  AND a.audit_source = 'auditoria_2026_08_05_segunda_passada'
  AND t.status = 'cancelada';

COMMIT;
