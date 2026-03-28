# Contribuicao: alliance-architect
**Data:** 2026-03-28
**Contexto:** Reuniao de planejamento — analise do estado atual do backend para avancar a Fase 7 (WhatsApp + IA)

---

## Status Atual (producao-ready vs pendente)

### Producao-ready (codigo implementado e estruturalmente correto)

| Componente | Arquivo | Observacao |
|---|---|---|
| PATCH move-stage | `api/leads/[id]/move-stage/route.ts` | Auth OK, enum validado, `updated_at` propagado |
| POST assign | `api/leads/[id]/assign/route.ts` | Auth OK, retorna `badge_color` para o frontend |
| POST pause | `api/leads/[id]/pause/route.ts` | Toggle correto via leitura previa do estado |
| POST send-message | `api/leads/[id]/send-message/route.ts` | Guard `automation_paused` funcionando, fallback gracioso sem credenciais |
| GET+POST meetings | `api/meetings/route.ts` | Cria reuniao, atualiza stage do lead atomicamente |
| POST imoveis toggle | `api/imoveis/[id]/toggle/route.ts` | Guard de role ADM correto |
| GET webhook (hub.challenge) | `api/webhooks/whatsapp/route.ts` | Verificacao Meta correta |
| POST webhook N8N | `api/webhooks/n8n/route.ts` | Validacao de secret, UPDATE de stage+summary |
| `lib/whatsapp/send.ts` | — | `sendTextMessage` e `sendTemplateMessage` implementados |
| `lib/supabase/server.ts` | — | `createServerClient` com SSR cookies correto |
| `lib/supabase/types.ts` | — | 7 tabelas tipadas, tipos de conveniencia exportados |
| Schema SQL | `001_schema.sql.sql` | 7 tabelas, RLS ativo, indices, trigger `updated_at`, seed imoveis |

### Pendente (ausente ou incompleto)

| Componente | Status | Impacto |
|---|---|---|
| `GET /api/leads/[id]` | Ausente | Frontend nao consegue buscar detalhes de um lead individual |
| `GET /api/leads` | Ausente | Kanban nao tem route de listagem; depende de query direta do cliente |
| `DELETE /api/meetings/[id]` | Ausente | Agenda nao permite cancelamento |
| `PATCH /api/meetings/[id]` | Ausente | Nao e possivel editar reuniao existente |
| `GET /api/interactions/[leadId]` | Ausente | Chat precisa desta rota para paginacao (Realtime nao carrega historico) |
| `POST /api/leads` (criacao via N8N) | Ausente | N8N nao consegue criar leads novos no banco |
| `GET /api/broadcasts/templates` | Ausente | Fase 9 bloqueada |
| `POST /api/broadcasts` | Ausente | Fase 9 bloqueada |
| `lib/whatsapp/templates.ts` | Ausente | `getApprovedTemplates()` nao implementado |
| Middleware de protecao de rotas | Ausente | Todas as rotas protegidas estao vulneraveis sem autenticacao SSR |
| `src/middleware.ts` | Ausente | Critico — sem ele, nao ha protecao no nivel do servidor |

---

## Gaps Criticos de Backend

### Gap 1 — Webhook WhatsApp nao usa `lib/whatsapp` e tem logica condicional fragil

O POST handler em `api/webhooks/whatsapp/route.ts` tem um ramo `else` que bypassa completamente a validacao HMAC em desenvolvimento:

```
if (appSecret && appSecret !== 'abc123...') {
  // valida HMAC
} else {
  // envia sem validar — VULNERABILIDADE em staging se a variavel nao for setada
}
```

Se `WHATSAPP_APP_SECRET` nao estiver definida em producao (erro de deploy), o sistema aceita qualquer requisicao sem validacao. A decisao bloqueada no `ARCHITECTURE-DECISIONS.md` exige validacao HMAC incondicional em producao. Este codigo viola essa decisao.

**Acao necessaria:** A validacao HMAC deve falhar fechado (`fail closed`): se `WHATSAPP_APP_SECRET` nao existir, retornar 500 com log de erro de configuracao, nunca processar o payload.

### Gap 2 — N8N nao consegue criar leads novos

`POST /api/webhooks/n8n/route.ts` so aceita `lead_id` para UPDATE. Quando o N8N recebe uma mensagem de um numero desconhecido, nao ha endpoint para criar o lead. O fluxo completo da Fase 7 exige:

1. Meta -> webhook -> N8N (ja funciona)
2. N8N identifica numero novo -> cria lead (AUSENTE — sem `POST /api/leads` com service role)
3. N8N processa com IA -> atualiza lead (funciona parcialmente)

Sem o step 2, todos os leads novos chegados via WhatsApp precisam ser criados manualmente.

### Gap 3 — `send-message` nao usa `lib/whatsapp/send.ts`

O arquivo `api/leads/[id]/send-message/route.ts` (linhas 49-65) reimplementa o fetch para a Meta API inline, duplicando a logica que ja existe em `lib/whatsapp/send.ts`. Isso significa:

- Erros na Meta API nao sao capturados nem registrados (o `catch` esta vazio)
- O `wa_message_id` retornado pela Meta nao e gravado na interacao criada
- `interactions.wa_message_id` fica sempre `null` para mensagens manuais, impedindo rastreamento de status de entrega

### Gap 4 — N8N webhook nao incrementa `interaction_count`

O `POST /api/webhooks/n8n` aceita `stage` e `summary`, mas nao aceita nem processa `interaction_count`. O BACKEND-BRIEF documenta este campo, mas a implementacao atual nao o atualiza. Isso faz com que o dashboard mostre contadores incorretos.

### Gap 5 — `GET /api/meetings` nao filtra por mes

O handler atual retorna todas as reunioes com `status = 'scheduled'` sem filtro de data. Com volume, isso e uma query completa na tabela. O BACKEND-BRIEF exige `?month=YYYY-MM`. Tambem nao faz JOIN com `user_profiles` para retornar `badge_color`, que e necessario para os pills coloridos do calendario.

---

## Seguranca — Pontos de Revisao

### Critico — Fail-open no webhook WhatsApp

Conforme descrito no Gap 1: a ausencia de `WHATSAPP_APP_SECRET` leva o sistema a processar webhooks sem validacao. Regra: se o secret nao estiver configurado, rejeitar com 500. Nunca processar.

### Critico — `send-message` nao usa `sendTextMessage` de `lib/whatsapp/send.ts`

O `catch {}` vazio na linha 63 de `send-message/route.ts` silencia erros da Meta API. Em producao, falhas de envio (token expirado, numero invalido, template nao aprovado) nao geram nenhum sinal observavel. Minimo aceitavel: logar o erro em servico de observabilidade.

### Moderado — N8N webhook usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` via `createClient()`

O arquivo `api/webhooks/n8n/route.ts` chama `await createClient()` de `src/lib/supabase/server.ts`, que usa a `ANON_KEY`. Isso significa que o UPDATE de leads feito pelo N8N esta sujeito a RLS. Se o lead nao tiver `assigned_to` preenchido, a policy `leads: ADM edita tudo, corretor edita os seus` vai bloquear o UPDATE silenciosamente (Supabase retorna sucesso sem afetar linhas). Para updates de sistema (IA atualizando stage/summary), o correto e usar `SUPABASE_SERVICE_ROLE_KEY`.

**Acao necessaria:** Criar variante `createServiceClient()` em `src/lib/supabase/server.ts` que usa `SUPABASE_SERVICE_ROLE_KEY`, para uso exclusivo em webhooks de sistema (n8n, whatsapp). Nunca expor essa funcao em Client Components.

### Moderado — Falta de validacao Zod em todas as routes

Nenhuma das routes implementadas usa Zod. A validacao e feita via checagens manuais (`if (!body.stage || !VALID_STAGES.includes(...))`). O BACKEND-BRIEF e o ARCHITECTURE-DECISIONS exigem Zod. Sem schema de validacao, inputs malformados podem causar queries com valores `undefined` que chegam ao banco sem erro aparente.

### Baixo — `as never` e `as any` recorrentes

`move-stage/route.ts` linha 26: `(supabase.from('leads') as any)`. Outros arquivos usam `update(update as never)`. Esses type casts manuais indicam incompatibilidade entre o tipo gerado em `types.ts` e a versao do SDK. O `PostgrestVersion: '12'` no topo de `types.ts` pode estar em desacordo com a versao real do SDK instalado. Verificar `@supabase/supabase-js` em `package.json`.

### Baixo — `ANTHROPIC_API_KEY` no `.env.example`

A chave da Anthropic esta documentada como variavel de ambiente da aplicacao Next.js. Se for usada diretamente no Next.js (nao apenas no N8N), ha risco de exposicao via bundle. O BACKEND-BRIEF determina: `ANTHROPIC_API_KEY` usada somente via N8N, nunca exposta no frontend. Confirmar que nenhum arquivo em `src/` importa esta variavel.

---

## Novas APIs Necessarias

Para completar a Fase 7 e preparar a Fase 9, as seguintes routes ainda precisam ser construidas:

### Fase 7 (WhatsApp + IA) — bloqueadores

```
POST /api/leads
  Auth: x-webhook-secret (service role, sem auth de usuario)
  Body: { phone: string, name?: string, wa_contact_id?: string }
  Logica: upsert por phone (E.164); retorna id do lead criado ou existente
  Notas: usa createServiceClient() com SUPABASE_SERVICE_ROLE_KEY

PATCH /api/webhooks/n8n (ou ampliar o POST existente)
  Ampliar body para: { lead_id, stage?, summary?, interaction_count?, new_interaction?: { content, direction, wa_message_id } }
  Logica: update lead + INSERT opcional em interactions numa unica chamada
  Notas: usa createServiceClient(); evita 2 roundtrips separados do N8N
```

### Fase 5/6 — complementares

```
GET /api/meetings?month=YYYY-MM
  Ampliar route existente com filtro de mes e JOIN com user_profiles

DELETE /api/meetings/[id]
  Auth obrigatorio; verificar ownership via RLS

GET /api/interactions/[leadId]?limit=50&before=<cursor>
  Historico paginado; ordenado por created_at ASC
  Necessario para carregamento inicial do chat (Realtime so entrega novos eventos)
```

### Fase 9 (Broadcasts) — planejamento

```
GET /api/broadcasts/templates
  Busca templates aprovados via lib/whatsapp/templates.ts
  Cache recomendado: 5 minutos

POST /api/broadcasts
  Auth: ADM obrigatorio
  Processa envio em massa via sendTemplateMessage
  Atualiza broadcast_numbers com status por numero
```

---

## Arquitetura Realtime

O Supabase Realtime e a escolha correta e esta na decisao bloqueada. Os pontos criticos de implementacao:

### Padrao correto para o Kanban (tabela `leads`)

```typescript
// Em kanban/page.tsx (Client Component)
// Subscribir a QUALQUER mudanca em leads — sem filtro de stage
// O filtro de stage e feito no estado local apos receber o evento

const channel = supabase
  .channel('kanban-leads')
  .on('postgres_changes', {
    event: '*',  // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'leads',
  }, (payload) => {
    // UPDATE: mover card para nova coluna sem fetch adicional
    // INSERT: adicionar card na coluna correta
    // DELETE: remover card
  })
  .subscribe()

// Cleanup obrigatorio no useEffect return
return () => { supabase.removeChannel(channel) }
```

**Atencao:** O payload do Realtime para UPDATE inclui `new` e `old`. Usar `payload.new` para atualizar o estado local diretamente, sem refetch.

### Padrao correto para Interacoes (tabela `interactions`)

```typescript
// Filtrar por lead_id para nao receber mensagens de outros leads
const channel = supabase
  .channel(`chat-${leadId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'interactions',
    filter: `lead_id=eq.${leadId}`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new as Interaction])
    // scroll automatico para o final
  })
  .subscribe()
```

### Consideracao critica — Realtime nao substitui carregamento inicial

O Realtime entrega apenas eventos apos a subscription ser ativa. O historico de mensagens existentes DEVE ser carregado via `GET /api/interactions/[leadId]` (que ainda esta ausente). Sem essa rota, o chat abre vazio e so mostra mensagens recebidas apos abrir a pagina.

### Limites do plano Supabase Free

- 200 conexoes Realtime simultaneas no plano free
- Com 5 usuarios ativos e multiplas subscriptions por usuario (kanban + interacoes + meetings), o limite pode ser atingido rapidamente
- Recomendacao: consolidar subscriptions por pagina; nunca criar multiplos channels para a mesma tabela no mesmo componente
- Monitorar via Supabase Dashboard > Realtime > Connections antes do deploy

### Row Broadcast vs Filtered Broadcast

Para o Kanban (muitos leads), usar `broadcast` level ao inves de `postgres_changes` pode reduzir overhead. Porem para o MVP com volume baixo (<500 leads), `postgres_changes` e adequado e mais simples.

---

## Proximos Passos para Deploy

### Prerequisito 0 — Correcoes criticas antes de qualquer fase

1. Corrigir fail-open no webhook WhatsApp (HMAC deve ser obrigatorio em producao)
2. Criar `createServiceClient()` em `lib/supabase/server.ts` e usa-la em `webhooks/n8n`
3. Migrar `send-message/route.ts` para usar `sendTextMessage` de `lib/whatsapp/send.ts` e gravar `wa_message_id`
4. Criar `src/middleware.ts` — sem ele, nenhuma rota esta protegida no nivel do servidor

### Prerequisito 1 — APIs ausentes para fechar Fase 6

- `GET /api/interactions/[leadId]` — chat precisa de historico
- `DELETE /api/meetings/[id]` — agenda precisa de cancelamento
- Ampliar `GET /api/meetings` com filtro de mes e JOIN `user_profiles`

### Prerequisito 2 — Fase 7 (WhatsApp + IA)

- `POST /api/leads` com service role (N8N cria leads)
- Ampliar payload do `POST /api/webhooks/n8n` para incluir `interaction_count` e `new_interaction`
- Configurar credenciais reais no Vercel/ambiente de producao
- Registrar URL do webhook na Meta Developer Console
- Testar ciclo completo: Meta -> webhook -> N8N -> `/api/webhooks/n8n` -> Supabase -> Realtime -> UI

### Prerequisito 3 — Variaveis de ambiente para producao

Todas as variaveis abaixo precisam estar preenchidas no ambiente de producao:

```
NEXT_PUBLIC_SUPABASE_URL        — obrigatorio
NEXT_PUBLIC_SUPABASE_ANON_KEY   — obrigatorio
SUPABASE_SERVICE_ROLE_KEY       — obrigatorio (apenas server-side)
WHATSAPP_ACCESS_TOKEN           — obrigatorio para Fase 7
WHATSAPP_PHONE_NUMBER_ID        — obrigatorio para Fase 7
WHATSAPP_APP_SECRET             — obrigatorio para Fase 7 (HMAC)
WHATSAPP_VERIFY_TOKEN           — obrigatorio para registro do webhook Meta
N8N_WEBHOOK_URL                 — obrigatorio para Fase 7
N8N_WEBHOOK_SECRET              — obrigatorio para Fase 7
NEXT_PUBLIC_APP_URL             — obrigatorio para CORS e links absolutos
```

`ANTHROPIC_API_KEY` permanece apenas no N8N, nunca no Next.js.

### Prerequisito 4 — Schema SQL (ajustes pendentes do MASTER-PLAN)

Os seguintes ajustes foram aprovados no MASTER-PLAN mas ainda nao foram aplicados ao schema:

- `sender_id uuid` em `interactions` (distinguir IA vs corretor)
- `idx_leads_updated` em `leads(updated_at DESC)`
- Trigger auto-insert em `user_profiles` apos `auth.users` INSERT
- Campo `title text` em `meetings`
- `idx_bcast_num_phone` em `broadcast_numbers(phone)`
- Indice composto `interactions(lead_id, created_at DESC)`

Estes devem ser aplicados como migration `002_schema_adjustments.sql` antes de qualquer deploy com dados reais.

---

## Prioridade Maxima (top 5)

1. **Criar `src/middleware.ts`** — sem protecao de rotas no servidor, qualquer rota protegida e acessivel sem autenticacao. Bloqueador de deploy.

2. **Corrigir fail-open no webhook WhatsApp** — a logica condicional de HMAC cria uma janela de ataque se `WHATSAPP_APP_SECRET` nao for setada em producao. Viola decisao bloqueada de arquitetura.

3. **Criar `createServiceClient()` e usa-la no webhook N8N** — sem service role, o N8N nao consegue atualizar leads sem `assigned_to`, tornando toda a automacao de IA silenciosamente nao-funcional para leads novos.

4. **Implementar `GET /api/interactions/[leadId]`** — o chat abre vazio sem esta rota. O Realtime sozinho nao carrega historico. Bloqueador da Fase 6.

5. **Implementar `POST /api/leads` com service role** — sem esta rota o N8N nao pode criar leads novos automaticamente. Bloqueador da Fase 7 (ciclo completo WhatsApp -> IA -> CRM).
