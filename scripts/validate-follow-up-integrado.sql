DO $$
DECLARE
  v_user uuid;
  v_lead uuid;
  v_task uuid;
  v_result jsonb;
  v_undo jsonb;
  v_call uuid;
  v_return timestamptz := now() + interval '2 days';
  v_text text;
BEGIN
  SELECT id INTO v_user FROM user_profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nenhum usuario para o teste'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO leads (name,phone,stage,assigned_to,aceitou_consultor)
  VALUES ('Teste Follow Up Integrado','5599999999999@s.whatsapp.net','lead_quente',v_user,true)
  RETURNING id INTO v_lead;

  -- Atendeu: conversa obrigatoria, reuniao apenas booleana, sem mover a etapa.
  INSERT INTO tarefas (lead_id,responsavel_id,origem,vence_em)
  VALUES (v_lead,v_user,'manual',now()) RETURNING id INTO v_task;
  SELECT registrar_ligacao_v2(v_task,'atendeu','Conversa de validacao.',NULL,true,NULL) INTO v_result;
  IF v_result#>>'{lead,stage}' <> 'lead_quente' THEN RAISE EXCEPTION 'Atendeu moveu a etapa'; END IF;
  IF v_result#>>'{call,meetingScheduled}' <> 'true' THEN RAISE EXCEPTION 'Reuniao nao foi registrada'; END IF;
  SELECT reuniao_em::text INTO v_text FROM ligacoes WHERE id=(v_result#>>'{call,id}')::uuid;
  IF v_text IS NOT NULL THEN RAISE EXCEPTION 'Reuniao recebeu data indevida'; END IF;

  -- Desfazer restaura tarefa e estado exato do lead.
  v_call := (v_result#>>'{call,id}')::uuid;
  SELECT desfazer_ligacao_v2(v_call) INTO v_undo;
  IF v_undo#>>'{task,status}' <> 'pendente' OR (v_undo#>>'{lead,attempts}')::int <> 0 THEN
    RAISE EXCEPTION 'Desfazer nao restaurou o estado';
  END IF;

  -- Nao atendeu gera uma retentativa e desfazer cancela a tarefa criada.
  SELECT registrar_ligacao_v2(v_task,'nao_atendeu',NULL,NULL,false,NULL) INTO v_result;
  IF v_result->'nextTask' IS NULL OR v_result#>>'{nextTask,origin}' <> 'retentativa' THEN
    RAISE EXCEPTION 'Nao atendeu nao gerou retentativa';
  END IF;
  v_call := (v_result#>>'{call,id}')::uuid;
  SELECT desfazer_ligacao_v2(v_call) INTO v_undo;
  IF NOT EXISTS (SELECT 1 FROM tarefas WHERE id=(v_result#>>'{nextTask,id}')::uuid AND status='cancelada') THEN
    RAISE EXCEPTION 'Desfazer nao cancelou a retentativa';
  END IF;

  -- Pediu retorno usa a data escolhida e nao exige observacao.
  SELECT registrar_ligacao_v2(v_task,'pediu_retorno',NULL,v_return,false,NULL) INTO v_result;
  IF v_result#>>'{nextTask,origin}' <> 'retorno_agendado' THEN RAISE EXCEPTION 'Retorno nao foi agendado'; END IF;
  PERFORM desfazer_ligacao_v2((v_result#>>'{call,id}')::uuid);

  -- Numero errado marca o cadastro e ainda agenda uma tentativa futura.
  SELECT registrar_ligacao_v2(v_task,'numero_errado',NULL,NULL,false,NULL) INTO v_result;
  IF v_result#>>'{lead,dataNeedsCorrection}' <> 'true' OR v_result->'nextTask' IS NULL THEN
    RAISE EXCEPTION 'Numero errado nao marcou correcao/retentativa';
  END IF;
  PERFORM desfazer_ligacao_v2((v_result#>>'{call,id}')::uuid);

  -- Sem interesse encerra a tarefa atual e retorna o lead para frio.
  SELECT registrar_ligacao_v2(v_task,'sem_interesse',NULL,NULL,false,'Momento de compra') INTO v_result;
  IF v_result#>>'{lead,stage}' <> 'lead_frio' OR v_result#>>'{lead,lossReason}' <> 'Momento de compra' THEN
    RAISE EXCEPTION 'Sem interesse nao retornou o lead para frio';
  END IF;

  RAISE NOTICE 'FOLLOW_UP_INTEGRADO_OK';
END;
$$;
