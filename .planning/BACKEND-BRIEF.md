# Backend Brief — CRM Alliance

## API Routes necessárias

### Auth (Phase 2)
- Server Action: `app/(auth)/login/actions.ts` — `signInWithPassword`
  - Chama `supabase.auth.signInWithPassword({ email, password })`
  - Em caso de sucesso: `redirect('/dashboard')`
  - Em caso de erro: retornar `{ error: 'Credenciais inválidas' }`
  - Nunca expor detalhes internos do Supabase Auth ao cliente

---

### Leads (Phase 4 — Kanban)

#### `PATCH /api/leads/[id]/stage`
Mover card entre colunas do Kanban. Auth obrigatório.
- Body: `{ stage: LeadStage }`
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Validar `stage` com Zod (enum dos 6 estágios válidos)
- RLS: corretor só edita leads com `assigned_to = seu id`; ADM edita tudo
- Resposta: `{ data: { id, stage }, error: null }`

#### `PATCH /api/leads/[id]/assign`
Atribuir consultor a um lead. Auth obrigatório.
- Body: `{ assigned_to: string | null }` — UUID do consultor ou null (devolver à IA)
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Validar UUID com Zod
- Ao atribuir: setar `automation_paused = false` (consultor assume, IA continua)
- Resposta: `{ data: { id, assigned_to, badge_color }, error: null }`

#### `PATCH /api/leads/[id]/pause`
Pausar/retomar automação de IA para um lead. Auth obrigatório.
- Body: `{ automation_paused: boolean }`
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Quando `automation_paused = true`: IA para de responder; input manual é liberado
- Resposta: `{ data: { id, automation_paused }, error: null }`

#### `POST /api/leads`
Criar lead via webhook interno (N8N). Usa service role — sem auth de usuário.
- Header obrigatório: `x-webhook-secret: N8N_WEBHOOK_SECRET`
- Validar header antes de qualquer operação — retornar 403 se inválido
- Body: `{ phone, name?, stage: 'lead_frio', wa_message_id? }`
- Usar `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) — somente nesta route
- Upsert por `phone` (evitar duplicatas)
- Resposta: `{ data: { id, phone, stage }, error: null }`

#### `POST /api/leads/[id]/send-message`
Envio manual de mensagem pelo corretor via interface de Interações. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Verificar `automation_paused = true` OR `stage = 'cliente'` antes de enviar
- Body: `{ message: string }`
- Chamar `lib/whatsapp/send.ts → sendTextMessage`
- INSERT na tabela `interactions` com `direction: 'outbound'`, `sender_type: 'human'`
- Resposta: `{ data: { interaction_id }, error: null }`

---

### Meetings (Phase 5 — Agenda)

#### `GET /api/meetings`
Listar reuniões do mês. Auth obrigatório.
- Query params: `?month=YYYY-MM`
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Validar formato de `month` com Zod
- JOIN com `user_profiles` para retornar `badge_color` do consultor
- Resposta: `{ data: Meeting[], error: null }`

#### `POST /api/meetings`
Criar reunião. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Body: `{ lead_id: string, scheduled_at: string (ISO 8601), notes?: string }`
- Validar com Zod: `lead_id` (UUID), `scheduled_at` (datetime válido, não no passado)
- Ao criar: atualizar `leads.stage = 'reuniao_agendada'` na mesma transação
- Resposta: `{ data: { id, lead_id, scheduled_at }, error: null }`

#### `DELETE /api/meetings/[id]`
Excluir reunião. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Validar que o meeting pertence a um lead acessível pelo usuário (RLS)
- Resposta: `{ data: { id }, error: null }`

---

### Interactions (Phase 6 — Chat)

#### `GET /api/interactions/[leadId]`
Histórico de interações de um lead. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Validar `leadId` como UUID com Zod
- Query params opcionais: `?limit=50&before=<cursor>`
- Ordenar por `created_at ASC`
- Resposta: `{ data: Interaction[], error: null }`

#### `POST /api/interactions/send`
Enviar mensagem manual pelo corretor. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Body: `{ lead_id: string, message: string }`
- Validar com Zod: `lead_id` (UUID), `message` (min 1, max 4096 chars)
- Verificar `automation_paused = true` OR `stage = 'cliente'` antes de processar
- Chamar `lib/whatsapp/send.ts → sendTextMessage`
- INSERT em `interactions` com `direction: 'outbound'`, `sender_type: 'human'`, `sender_id = user.id`
- Resposta: `{ data: Interaction, error: null }`

---

### WhatsApp Webhook (Phase 7)

#### `GET /api/webhooks/whatsapp`
Verificação do webhook pela Meta. Sem auth de usuário.
- Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`
- Verificar `hub.verify_token === WHATSAPP_VERIFY_TOKEN`
- Se válido: retornar `hub.challenge` como texto puro (status 200)
- Se inválido: retornar 403

#### `POST /api/webhooks/whatsapp`
Receber mensagem de WhatsApp. Sem auth de usuário — validar HMAC.
- **Primeiro passo obrigatório:** validar header `X-Hub-Signature-256`
  ```
  HMAC SHA256(body_raw, WHATSAPP_APP_SECRET) === X-Hub-Signature-256
  ```
- Rejeitar com 403 se HMAC inválido — sem processar nada
- Extrair: `phone`, `message`, `wa_message_id` do payload Meta
- Repassar ao N8N: `POST N8N_WEBHOOK_URL` com header `x-webhook-secret: N8N_WEBHOOK_SECRET`
- Responder 200 imediatamente (Meta exige resposta rápida — processamento é assíncrono)
- Nunca logar `WHATSAPP_APP_SECRET` ou conteúdo de mensagens com dados sensíveis

#### `POST /api/webhooks/n8n`
Receber atualizações de stage e summary vindos do N8N após processamento da IA.
- Header obrigatório: `x-webhook-secret: N8N_WEBHOOK_SECRET`
- Validar header antes de qualquer operação — retornar 403 se inválido
- Usar `SUPABASE_SERVICE_ROLE_KEY` para UPDATE (bypassa RLS)
- Body: `{ lead_id, stage?, summary?, interaction_count? }`
- Validar com Zod antes de processar
- Supabase Realtime notifica automaticamente Kanban e Interações
- Resposta: `{ data: { updated: true }, error: null }`

---

### Broadcasts (Phase 9 — Disparos)

#### `POST /api/broadcasts`
Iniciar campanha de disparo HSM. Auth obrigatório — somente ADM.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Verificar `user_profiles.role = 'adm'` — retornar 403 se não for ADM
- Body: `{ template_name, template_language, numbers: string[], variables?: string[] }`
- Validar números no formato E.164 com Zod
- Processar via `lib/whatsapp/send.ts → sendTemplateMessage`
- Resposta: `{ data: { broadcast_id, total, queued }, error: null }`

#### `GET /api/broadcasts/templates`
Buscar templates aprovados da Meta API. Auth obrigatório.
- Verificar `auth.getUser()` primeiro — retornar 401 se não autenticado
- Chamar `lib/whatsapp/templates.ts → getApprovedTemplates`
- Cache recomendado: 5 minutos (templates não mudam frequentemente)
- Resposta: `{ data: Template[], error: null }`

---

## Middleware (Phase 2)

Arquivo: `src/middleware.ts`

- Proteger todas as rotas exceto: `/`, `/login`, `/api/webhooks/*`
- Usar `createServerClient` do `@supabase/ssr` com cookies do request
- Chamar `supabase.auth.getUser()` — redirecionar para `/login` se não autenticado
- Atualizar cookies de sessão no response (refresh token automático)
- Matcher config:
  ```typescript
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)']
  }
  ```

---

## Validações críticas (por route)

| Route | Validações Zod |
|-------|---------------|
| `PATCH /api/leads/[id]/stage` | `stage: z.enum(['lead_frio','lead_morno','lead_quente','reuniao_agendada','follow_up','visita_confirmada','cliente'])` |
| `PATCH /api/leads/[id]/assign` | `assigned_to: z.string().uuid().nullable()` |
| `PATCH /api/leads/[id]/pause` | `automation_paused: z.boolean()` |
| `POST /api/leads` | `phone: z.string().min(10)`, `name: z.string().optional()`, `stage: z.literal('lead_frio')` |
| `POST /api/leads/[id]/send-message` | `message: z.string().min(1).max(4096)` |
| `GET /api/meetings` | `month: z.string().regex(/^\d{4}-\d{2}$/)` |
| `POST /api/meetings` | `lead_id: z.string().uuid()`, `scheduled_at: z.string().datetime()`, `notes: z.string().max(500).optional()` |
| `GET /api/interactions/[leadId]` | `leadId: z.string().uuid()` (via params), `limit: z.number().max(100).optional()` |
| `POST /api/interactions/send` | `lead_id: z.string().uuid()`, `message: z.string().min(1).max(4096)` |
| `GET /api/webhooks/whatsapp` | `hub.verify_token === WHATSAPP_VERIFY_TOKEN` (comparação direta) |
| `POST /api/webhooks/whatsapp` | HMAC SHA256 antes do Zod; payload Meta validado após |
| `POST /api/webhooks/n8n` | `lead_id: z.string().uuid()`, `stage: z.enum([...]).optional()`, `summary: z.string().optional()` |
| `POST /api/broadcasts` | `numbers: z.array(z.string().regex(/^\+[1-9]\d{7,14}$/))`, `template_name: z.string().min(1)` |

---

## Segurança — checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca em client components (`'use client'`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca com prefixo `NEXT_PUBLIC_`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca em logs ou respostas de API
- [ ] Webhook Meta (`POST /api/webhooks/whatsapp`): validar HMAC SHA256 antes de qualquer processamento
- [ ] Webhook N8N (`POST /api/webhooks/n8n`): validar `N8N_WEBHOOK_SECRET` no header antes de qualquer processamento
- [ ] Todas as routes autenticadas: `auth.getUser()` como **primeira** operação
- [ ] Broadcasts: verificar `role = 'adm'` após autenticação
- [ ] Sem `any` em TypeScript — usar tipos de `src/lib/supabase/types.ts`
- [ ] Sem `as unknown` ou type assertions desnecessárias
- [ ] Sem `console.log` com tokens, telefones ou dados sensíveis
- [ ] `.env.local` no `.gitignore`
- [ ] `ANTHROPIC_API_KEY` usada somente via N8N (nunca exposta no frontend)
- [ ] Retorno padronizado `{ data, error }` em todas as routes — nunca throw sem catch
- [ ] HMAC comparado com `timingSafeEqual` (evitar timing attacks)

---

## Libs de suporte (server-side only)

| Arquivo | Função |
|---------|--------|
| `src/lib/supabase/server.ts` | `createServerClient` com cookies — para Server Components e API routes |
| `src/lib/supabase/client.ts` | `createBrowserClient` — somente em `'use client'` components |
| `src/lib/whatsapp/send.ts` | `sendTextMessage(phone, message)` + `sendTemplateMessage(phone, template, vars)` via Meta Cloud API |
| `src/lib/whatsapp/templates.ts` | `getApprovedTemplates()` — busca templates aprovados na Meta API |

---

## Backend aprovado: SIM
