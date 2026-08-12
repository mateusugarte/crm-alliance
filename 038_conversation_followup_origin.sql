-- Acompanhamento comercial criado depois de uma ligacao atendida.
-- Mantido separado de retentativa (sem contato) e retorno agendado (pedido do lead).

ALTER TYPE tarefa_origem ADD VALUE IF NOT EXISTS 'acompanhamento';
