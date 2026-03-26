# DB Brief — CRM Alliance

> Agente: `alliance-db` | Data: 2026-03-26 | Fonte: `001_schema.sql.sql` + `CLAUDE.md.md` + `ROADMAP.md.md`

---

## Tabelas identificadas

| Tabela | Status | Observações |
|--------|--------|-------------|
| `user_profiles` | ✅ Completa | Extensão de `auth.users` via FK. Campos: `id`, `full_name`, `role` (CHECK: `adm`/`corretor`), `badge_color` (hex, default `#0A2EAD`), `created_at`. Sem campo `updated_at` — intencional (perfis raramente mudam). |
| `leads` | ✅ Completa | Tabela central do CRM. 13 campos. `phone` com constraint UNIQUE (E.164). `stage` com 7 valores via CHECK. `intention` nullable (`morar`/`investir`). `imovel_interesse` text livre (deve referenciar IDs da tabela `imoveis`: `Apto_01`…`Cob_02`). `summary` atualizado pela IA após cada interação. `interaction_count` incrementado pelo N8N. Trigger `leads_updated_at` ativo. |
| `interactions` | ✅ Completa | Histórico imutável (sem UPDATE/DELETE via RLS). `direction` CHECK (`inbound`/`outbound`). `wa_message_id` nullable (mensagens manuais de corretores não têm ID Meta). Sem `updated_at` — correto para registro imutável. |
| `meetings` | ✅ Completa | `datetime` timestamptz NOT NULL. `status` CHECK (`scheduled`/`completed`/`cancelled`). `assigned_to` ON DELETE SET NULL — reunião não é deletada se o corretor sair. Sem `updated_at`. |
| `broadcasts` | ✅ Completa | Contadores `total`, `sent`, `failed` (integer DEFAULT 0) atualizados pelo N8N durante execução da campanha. `template_params` jsonb para variáveis do template HSM. `message_preview` para exibição na UI antes do envio. |
| `broadcast_numbers` | ✅ Completa | Granularidade por número individual da campanha. `sent_at` nullable (preenchido apenas quando `status = 'sent'`). Sem `updated_at` — status final, sem histórico de mudanças. Sem DELETE policy — registros permanentes para auditoria. |
| `imoveis` | ✅ Completa | PK `text` (`Apto_01`, `Apto_02`, `Apto_03`, `Apto_04`, `Cob_01`, `Cob_02`). `diferenciais` como `text[]`. `valor_min`/`valor_max` numeric (sem escala definida — recomenda-se `numeric(12,2)`). Sem `created_at`/`updated_at` — tabela estática. |

**Total: 7 tabelas | Extensão uuid-ossp ativa**

---

## RLS Policies — status

RLS habilitado em **todas as 7 tabelas** via `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.

Função auxiliar `is_adm()` definida com `SECURITY DEFINER` — evita recursão e garante leitura segura de `user_profiles` sem bypass de RLS.

| Tabela | SELECT | INSERT | UPDATE | DELETE | Cobertura |
|--------|--------|--------|--------|--------|-----------|
| `user_profiles` | Todos autenticados | Apenas ADM | Próprio ou ADM | ❌ Sem policy | ⚠️ Falta DELETE |
| `leads` | Todos autenticados | Todos autenticados | ADM (tudo) / Corretor (assigned_to = uid) | Apenas ADM | ✅ Completa |
| `interactions` | Todos autenticados | Todos autenticados | ❌ Sem policy (intencional) | ❌ Sem policy (intencional) | ✅ Correto — imutabilidade |
| `meetings` | Todos autenticados | Todos autenticados | ADM (tudo) / Corretor (assigned_to = uid) | Apenas ADM | ✅ Completa |
| `broadcasts` | Todos autenticados | Apenas ADM | Apenas ADM | Apenas ADM | ✅ Completa |
| `broadcast_numbers` | Todos autenticados | Apenas ADM | Apenas ADM | ❌ Sem policy (intencional) | ✅ Correto — sem deleção |
| `imoveis` | Todos autenticados | Apenas ADM (via ALL) | Apenas ADM (via ALL) | Apenas ADM (via ALL) | ✅ Completa |

**Observações críticas de RLS:**

1. `user_profiles` não tem DELETE policy. Se um usuário for removido do `auth.users`, o `ON DELETE CASCADE` na FK trata a remoção automaticamente — ausência de policy DELETE é aceitável mas deve ser documentada.
2. Webhook/N8N usa `SUPABASE_SERVICE_ROLE_KEY` server-side — bypassa RLS corretamente. Nunca deve usar `anon_key` para operações automatizadas.
3. A policy de INSERT em `leads` permite que qualquer corretor autenticado crie leads — correto para o fluxo manual do Kanban (botão "Novo Lead").
4. `interactions` sem UPDATE/DELETE policies é design intencional — o histórico é imutável. Somente `service_role` (N8N/webhooks) pode alterar via bypass.

---

## Índices — análise

### Índices existentes (10 total)

| Índice | Tabela | Coluna(s) | Justificativa |
|--------|--------|-----------|---------------|
| `idx_leads_stage` | `leads` | `stage` | Kanban filtra por coluna/stage — alto volume de leituras |
| `idx_leads_assigned` | `leads` | `assigned_to` | Filtro por corretor responsável |
| `idx_leads_phone` | `leads` | `phone` | Lookup por telefone no webhook WhatsApp (crítico, UNIQUE já cobre) |
| `idx_leads_created` | `leads` | `created_at DESC` | Ordenação cronológica decrescente no Kanban/Dashboard |
| `idx_interactions_lead` | `interactions` | `lead_id` | JOIN lead ↔ interactions em toda abertura de chat |
| `idx_interactions_dir` | `interactions` | `(lead_id, direction)` | Filtro inbound/outbound por lead na tela Interações |
| `idx_meetings_lead` | `meetings` | `lead_id` | Busca reuniões de um lead específico |
| `idx_meetings_assigned` | `meetings` | `assigned_to` | Agenda filtrada por corretor |
| `idx_meetings_datetime` | `meetings` | `datetime` | Renderização do calendário mensal por data |
| `idx_broadcasts_status` | `broadcasts` | `status` | Filtro campanhas ativas/concluídas |
| `idx_bcast_num_bcast` | `broadcast_numbers` | `broadcast_id` | JOIN broadcast ↔ números para progresso em tempo real |

### Índices ausentes — análise

| Índice sugerido | Tabela | Motivo |
|-----------------|--------|--------|
| `idx_leads_updated` ON `leads(updated_at DESC)` | `leads` | Dashboard "métricas do dia" provavelmente filtra por data de atualização recente |
| `idx_leads_automation` ON `leads(automation_paused)` | `leads` | N8N verifica `automation_paused` a cada mensagem recebida |
| `idx_interactions_created` ON `interactions(lead_id, created_at DESC)` | `interactions` | Busca "últimas 10 mensagens" pelo N8N — sem índice em `created_at` pode ser lento com volume |
| `idx_bcast_num_status` ON `broadcast_numbers(broadcast_id, status)` | `broadcast_numbers` | Contagem de `sent`/`failed` para progresso Realtime da campanha |

**Veredicto:** Cobertura de índices é boa para o MVP. Os 4 índices sugeridos devem ser adicionados antes da Phase 7 (WhatsApp + IA), quando o volume de operações automáticas aumenta significativamente.

---

## Tipos TypeScript a gerar (`src/lib/supabase/types.ts`)

Tipos principais que devem ser exportados:

```typescript
// Enums/unions de domínio
export type UserRole = 'adm' | 'corretor'
export type LeadStage = 'lead_frio' | 'lead_morno' | 'lead_quente' | 'follow_up' | 'reuniao_agendada' | 'visita_confirmada' | 'cliente'
export type LeadIntention = 'morar' | 'investir'
export type InteractionDirection = 'inbound' | 'outbound'
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled'
export type BroadcastStatus = 'draft' | 'running' | 'completed' | 'cancelled'
export type BroadcastNumberStatus = 'pending' | 'sent' | 'failed'
export type ImovelId = 'Apto_01' | 'Apto_02' | 'Apto_03' | 'Apto_04' | 'Cob_01' | 'Cob_02'

// Interfaces de tabelas (linhas completas do banco)
export interface UserProfile { ... }
export interface Lead { ... }
export interface Interaction { ... }
export interface Meeting { ... }
export interface Broadcast { ... }
export interface BroadcastNumber { ... }
export interface Imovel { ... }

// Tipos de insert (campos obrigatórios sem defaults)
export type InsertLead = Pick<Lead, 'name' | 'phone'> & Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>
export type InsertInteraction = Pick<Interaction, 'lead_id' | 'direction' | 'content'>
export type InsertMeeting = Pick<Meeting, 'lead_id' | 'datetime'>
export type InsertBroadcast = Pick<Broadcast, 'template_name'>

// Tipos de update (todos os campos opcionais exceto id)
export type UpdateLead = Partial<Omit<Lead, 'id' | 'created_at'>>
export type UpdateMeeting = Partial<Omit<Meeting, 'id' | 'created_at'>>

// Tipos compostos para UI
export interface LeadWithProfile extends Lead {
  user_profiles: Pick<UserProfile, 'full_name' | 'badge_color'> | null
}
export interface MeetingWithLead extends Meeting {
  leads: Pick<Lead, 'name' | 'phone'> | null
  user_profiles: Pick<UserProfile, 'full_name' | 'badge_color'> | null
}
```

**Nota:** Gerar via `supabase gen types typescript --project-id lmvdruvmpybutmmidrfp` após executar o schema. Não criar manualmente — usar o gerado como base e adicionar os tipos compostos manualmente.

---

## Seed de imóveis (6 unidades La Reserva)

**Status: PRESENTE NO SCHEMA** — seed incluído diretamente no `001_schema.sql.sql`.

```sql
INSERT INTO imoveis (id, nome, metragem, quartos, suites, diferenciais, valor_min, valor_max, disponivel)
VALUES
  ('Apto_01', 'Apartamento 01', 146.00, 3, 1, ['1 suíte','1 closet'],          894000, 930000,  true),
  ('Apto_02', 'Apartamento 02',  90.80, 2, 1, ['1 suíte'],                     535000, 546000,  true),
  ('Apto_03', 'Apartamento 03', 110.85, 3, 1, ['1 suíte'],                     653000, 692000,  true),
  ('Apto_04', 'Apartamento 04', 144.80, 3, 1, ['1 suíte','1 closet'],          840000, 883000,  true),
  ('Cob_01',  'Cobertura 01',  245.60, 4, 2, ['cobertura exclusiva','2 suítes com closet'], 1791000, 1791000, true),
  ('Cob_02',  'Cobertura 02',  259.95, 4, 2, ['cobertura exclusiva','2 suítes com closet'], 1692000, 1692000, true)
ON CONFLICT (id) DO NOTHING;
```

Seed é idempotente (`ON CONFLICT DO NOTHING`) — pode ser reexecutado sem risco de duplicatas.

**Seed de `user_profiles` está comentado** — deve ser executado separadamente após criar os 5 usuários no Supabase Auth Dashboard:
- `lucas@alliance.com.br` → Lucas, corretor, `#0A2EAD`
- `joao@alliance.com.br` → João, corretor, `#FF6B00`
- `marco@alliance.com.br` → Marco, corretor, `#0A2EAD`
- `jaque@alliance.com.br` → Jaque, corretor, `#0A2EAD`
- `adm@alliance.com.br` → ADM, adm, `#0A2EAD`

---

## Método de execução do schema

**Recomendação: Supabase SQL Editor (manual) ou Management API (automatizado pelo agente)**

### Opção 1 — Manual (garantido, zero dependências)
```
Supabase Dashboard → Project → SQL Editor → New Query
→ Colar conteúdo de 001_schema.sql.sql
→ Run (Ctrl+Enter)
→ Verificar: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

### Opção 2 — Management API (para o agente alliance-db executar automaticamente)
```bash
# POST para executar SQL diretamente
curl -X POST \
  "https://api.supabase.com/v1/projects/lmvdruvmpybutmmidrfp/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "<conteúdo do SQL>"}'
```
**Atenção:** Requer `SUPABASE_ACCESS_TOKEN` (token pessoal do painel, diferente do `SERVICE_ROLE_KEY`).

### Opção 3 — Supabase CLI
```bash
# Requer DATABASE_URL (connection string com senha do projeto)
cat 001_schema.sql.sql | npx supabase db execute --db-url "${DATABASE_URL}"
# ou
npx supabase db push --db-url "${DATABASE_URL}"
```

### Verificação pós-execução (queries de confirmação)
```sql
-- 1. Verificar tabelas e RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2. Verificar policies
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- 3. Verificar seed de imóveis
SELECT id, nome, metragem, valor_min, valor_max FROM imoveis ORDER BY id;

-- 4. Verificar índices
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
```

---

## Schema aprovado: SIM

O schema está tecnicamente correto, RLS cobrindo todos os casos de uso documentados, seed incluído e índices adequados para o MVP.

---

## Observações críticas

1. **`leads.imovel_interesse` é `text` sem FK para `imoveis.id`** — a IA pode escrever valores fora do conjunto válido (`Apto_01`…`Cob_02`). Considerar adicionar CHECK constraint: `CHECK (imovel_interesse IN ('Apto_01','Apto_02','Apto_03','Apto_04','Cob_01','Cob_02') OR imovel_interesse IS NULL)`. Baixo risco no MVP — o prompt da IA deve restringir os valores.

2. **`imoveis.valor_min` / `valor_max` sem escala definida (`numeric` sem precisão)** — valores como `1791000` são armazenados corretamente, mas recomenda-se `numeric(12,2)` para consistência com formatação monetária pt-BR no frontend.

3. **Seed de `user_profiles` comentado e dependente de Auth** — o agente `alliance-db` não pode executar este bloco automaticamente sem que os 5 usuários existam primeiro no `auth.users`. O plano 02-02 deve incluir instrução para o usuário criar os contas no Auth Dashboard antes da execução do bloco comentado.

4. **`interactions` sem campo `sender_id`** — mensagens outbound de corretores não identificam qual corretor enviou a mensagem no nível do banco (apenas via `assigned_to` do lead). Para a tela de chat mostrar "nome do corretor" abaixo da mensagem, o frontend precisará inferir o remetente pelo contexto. Se necessário, adicionar `sender_id uuid REFERENCES auth.users(id)` em `interactions` antes da Phase 6.

5. **`meetings` sem `updated_at`** — reuniões podem ser canceladas ou remarcadas. Considerar adicionar `updated_at timestamptz DEFAULT now()` com trigger análogo ao de `leads`, útil para sincronização do calendário.

6. **`broadcast_numbers` sem DELETE policy** — intencional para auditoria, mas deve ser documentado explicitamente. Campanhas grandes podem gerar muitos registros. Considerar política de retenção após Phase 9.

7. **Execução do schema é idempotente** — todos os `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` e `ON CONFLICT DO NOTHING` garantem reexecução segura. O `DROP TRIGGER IF EXISTS` antes do `CREATE TRIGGER` também é idempotente. Schema pode ser reexecutado em caso de erro parcial.
