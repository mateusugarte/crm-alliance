-- Keep operational links working until crm.alliance.com.br has a public DNS record.
-- Revert only the configured value after the custom domain becomes available.

UPDATE configuracoes_sistema
SET valor = jsonb_set(
      COALESCE(valor, '{}'::jsonb),
      '{crm_base_url}',
      to_jsonb('https://crm-alliance.vercel.app'::text),
      true
    ),
    atualizado_em = now()
WHERE chave = 'central_do_dia';
