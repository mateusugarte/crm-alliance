# DB-STATUS — CRM Alliance
**Atualizado:** 2026-04-01
**Agente:** alliance-db
**Projeto Supabase:** lmvdruvmpybutmmidrfp

---

## Status da Migration 002_labels.sql

### Resultado: PENDENTE — Acao Manual Necessaria

A migration `002_labels.sql` NAO foi executada. As tabelas `labels` e `lead_labels` nao existem no banco.

**Verificacao realizada via API REST (service_role_key):**
- `GET /rest/v1/labels` -> HTTP 404 (tabela nao encontrada)
- `GET /rest/v1/lead_labels` -> HTTP 404 (tabela nao encontrada)

---

## Motivo pelo qual a execucao automatica falhou

A service_role_key JWT do Supabase da acesso somente a operacoes DML (INSERT/SELECT/UPDATE/DELETE) via PostgREST REST API. Para executar DDL (CREATE TABLE, ALTER TABLE, CREATE POLICY), e necessario um dos seguintes:

1. **Senha do banco Postgres** — para conexao direta na porta 5432
   - Host: `db.lmvdruvmpybutmmidrfp.supabase.co:5432`
   - Usuario: `postgres`
   - Senha: configurada no Supabase Dashboard (nao disponivel nos arquivos do projeto)

2. **Personal Access Token** — para usar o Supabase CLI (`sbp_...`)
   - Necessario para `npx supabase db query --linked`
   - Formato diferente da service_role_key

3. **Acesso ao Supabase Dashboard** — para usar o SQL Editor diretamente

A service_role_key disponivel no `crm-alliance/.env.local` funciona apenas para operacoes via API REST.

---

## Acao Necessaria — Executar Manualmente

### Opcao 1: SQL Editor do Supabase Dashboard (mais rapido)

1. Acesse https://supabase.com/dashboard/project/lmvdruvmpybutmmidrfp/sql/new
2. Cole e execute o SQL abaixo:

```sql
-- Migration 002_labels.sql
-- CRM Alliance — Etiquetas de Leads

-- Tabela de etiquetas
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1E90FF',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de juncao lead-etiqueta
CREATE TABLE IF NOT EXISTS lead_labels (
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lead_id, label_id)
);

-- RLS
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_labels ENABLE ROW LEVEL SECURITY;

-- Policies: todos autenticados leem, apenas criador/adm deleta
CREATE POLICY "labels_read" ON labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "labels_insert" ON labels FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "labels_delete" ON labels FOR DELETE TO authenticated USING (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'adm')
);

CREATE POLICY "lead_labels_read" ON lead_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_labels_insert" ON lead_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lead_labels_delete" ON lead_labels FOR DELETE TO authenticated USING (true);
```

### Opcao 2: Supabase CLI com Personal Access Token

1. Obtenha o Personal Access Token em https://supabase.com/dashboard/account/tokens
2. Execute:

```bash
cd /c/Users/User/Desktop/la-reserva-system
SUPABASE_ACCESS_TOKEN=sbp_seu_token_aqui npx supabase db query \
  --linked \
  --project-ref lmvdruvmpybutmmidrfp \
  -f 002_labels.sql
```

### Opcao 3: Conexao direta ao Postgres (requer senha do banco)

A senha do banco esta disponivel em:
https://supabase.com/dashboard/project/lmvdruvmpybutmmidrfp/settings/database

Com ela, adicione ao `crm-alliance/.env.local`:
```
SUPABASE_DB_PASSWORD=sua_senha_aqui
```

E execute o script de migration diretamente:
```bash
cd /c/Users/User/Desktop/la-reserva-system
SUPABASE_DB_PASSWORD=sua_senha node exec_migration.cjs
```

---

## Checklist de Validacao Pos-Migration

Apos executar o SQL, verifique com estas queries no SQL Editor:

```sql
-- 1. Verificar tabelas criadas com RLS ativo
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('labels', 'lead_labels');
-- Esperado: 2 linhas com rowsecurity = true

-- 2. Verificar policies criadas
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('labels', 'lead_labels')
ORDER BY tablename, policyname;
-- Esperado: 6 linhas (3 para labels, 3 para lead_labels)

-- 3. Verificar estrutura das colunas
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('labels', 'lead_labels')
ORDER BY table_name, ordinal_position;
```

---

## Estado Atual do Banco (verificado via API)

| Tabela | Status |
|--------|--------|
| labels | NAO EXISTE |
| lead_labels | NAO EXISTE |
| leads | EXISTE (confirmado via OpenAPI) |
| imoveis | EXISTE (confirmado via OpenAPI) |
| meetings | EXISTE (confirmado via OpenAPI) |
| interactions | EXISTE (confirmado via OpenAPI) |
| user_profiles | EXISTE (confirmado via OpenAPI) |
| broadcasts | EXISTE (confirmado via OpenAPI) |
| broadcast_numbers | EXISTE (confirmado via OpenAPI) |
| documents | EXISTE (confirmado via OpenAPI) |

---

## Tabelas Existentes com RLS

As tabelas existentes tem RLS configurado (confirmado via schema OpenAPI publicado). A tabela `leads` tem as colunas corretas para a foreign key de `lead_labels`.

---

## Pre-requisito para execucoes Futuras

Para automatizar migrations futuras sem acao manual, adicione ao `crm-alliance/.env.local`:

```
# Senha do banco Postgres (Settings > Database no Dashboard)
SUPABASE_DB_PASSWORD=

# OU Personal Access Token (Account > Access Tokens no Dashboard)
SUPABASE_ACCESS_TOKEN=
```

Com qualquer uma dessas credenciais, o agente alliance-db pode executar migrations automaticamente.

---

## Arquivos da Migration

- SQL: `/c/Users/User/Desktop/la-reserva-system/002_labels.sql`
- Este relatorio: `/c/Users/User/Desktop/la-reserva-system/.planning/DB-STATUS.md`
