# MASTER-PLAN — CRM Alliance
**Sintetizado por:** alliance-planner
**Data:** 2026-03-26
**Fontes:** ARCHITECTURE-DECISIONS.md + DESIGN-BRIEF.md + DB-BRIEF.md + BACKEND-BRIEF.md

---

## Status dos especialistas

| Especialista | Veredicto | Observações |
|---|---|---|
| **Arquiteto** (alliance-architect) | ✅ APROVADO | 5 ajustes no schema, wave map completo produzido |
| **Designer** (alliance-design) | ✅ APROVADO | Design brief completo, tokens e animações documentados |
| **Banco** (alliance-db) | ✅ APROVADO | 7 tabelas OK, 4 índices adicionais recomendados |
| **Backend** (alliance-backend) | ✅ APROVADO | 14 API routes mapeadas, validações Zod documentadas |

---

## Ajustes ao schema SQL identificados

| Ajuste | Motivo | Quem identificou |
|---|---|---|
| Adicionar `sender_id uuid` em `interactions` | Distinguir IA vs corretor no chat | architect + db |
| Adicionar índice `idx_leads_updated` em `leads(updated_at DESC)` | Performance sidebar Interações | architect |
| Criar trigger auto-insert em `user_profiles` após `auth.users` INSERT | Evitar usuário sem perfil | architect + db |
| Adicionar campo `title text` em `meetings` | Pills do calendário precisam de texto curto | architect |
| Adicionar índice `idx_bcast_num_phone` em `broadcast_numbers(phone)` | Performance Phase 9 | db |
| Adicionar índice em `interactions(lead_id, created_at DESC)` | Performance tela de chat | db |

> **Decisão:** Os ajustes serão incorporados ao 001_schema.sql antes da execução do Phase 2. Alliance-db será responsável por aplicar.

---

## Wave map definitivo

### Phase 1 — Design System
```
Wave 1 (paralela):
  Plan 01-01 — Next.js 14 setup + dependências + tailwind.config.ts + shadcn/ui init
  (standalone, sem dependência interna)

Wave 2 (depende de 01-01):
  Plan 01-02 — Componentes base: BlobBottom, BlobHeader, NavShell, AllianceBadge,
               AllianceCard, PageTransition + src/lib/animations.ts

Wave 3 (depende de 01-02):
  Plan 01-03 — Splash screen animada (app/page.tsx) + Login visual (app/(auth)/login/page.tsx)
```

### Phase 2 — Fundação
```
Wave 1 (depende de Phase 1):
  Plan 02-01 — src/lib/supabase/client.ts + server.ts + types.ts + teste conectividade

⚠️ CHECKPOINT HUMANO — aguardar credenciais .env.local antes de Wave 2

Wave 2 (depende de 02-01, PARALELOS entre si):
  Plan 02-02 — alliance-db: aplicar ajustes SQL + executar 001_schema.sql + validar RLS + seed imóveis
  Plan 02-03 — Auth Server Action + middleware.ts + conectar login ao Supabase Auth real
```

### Phase 3 — Dashboard
```
Wave 1 (depende de Phase 2):
  Plan 03-01 — Layout /dashboard + MetricCard (featured/default) + MetricsGrid (2×3) + skeleton

Wave 2 (depende de 03-01, PARALELOS):
  Plan 03-02 — ActivityChart: 2 gráficos Chart.js barras (#1E90FF) + animações stagger
  Plan 03-03 — Queries Supabase reais + saudação dinâmica + counter animado (spring)

Wave 3 (depende de 03-02 e 03-03):
  [alliance-qa verifica]
```

### Phase 4 — Kanban
```
Wave 1 (depende de Phase 2):
  Plan 04-01 — KanbanBoard (DndContext) + KanbanColumn × 6 + buscar leads por stage

Wave 2 (depende de 04-01):
  Plan 04-02 — LeadCard draggable + badge dinâmico + Realtime leads + UPDATE stage drag-end

Wave 3 (depende de 04-02, PARALELOS):
  Plan 04-03 — LeadModal (AnimatePresence + modalAnimation) + campos completos do lead
  Plan 04-04 — AssignButton + PauseButton + API routes /assign e /pause

Wave 4 (depende de 04-03 e 04-04):
  [alliance-qa verifica]
```

### Phase 5 — Agenda
```
Wave 1 (depende de Phase 4):
  Plan 05-01 — Layout calendário mensal + pt-BR + célula hoje alliance-blue + navegação mês/ano

Wave 2 (depende de 05-01):
  Plan 05-02 — MeetingPill com badge_color do consultor + queries meetings por mês

Wave 3 (depende de 05-02):
  Plan 05-03 — CreateMeetingDialog + POST /api/meetings + sync Kanban→Agenda via Realtime

[alliance-qa verifica]
```

### Phase 6 — Imóveis + Interações
```
Wave 1 (depende de Phase 4, PARALELOS entre si):
  Plan 06-01 — /imoveis: 6 ImóvelCard com dados Supabase + stagger de entrada
  Plan 06-02 — /interacoes: layout sidebar (#0A2EAD) + área de chat (#CCCCCC)
               + MessageBubble (inbound azul / outbound branco) + Realtime

Wave 2 (depende de 06-02):
  Plan 06-03 — Input envio manual (se automation_paused) + POST /api/leads/[id]/send-message
               + lib/whatsapp/send.ts → Meta API

[alliance-qa verifica]
```

---

## API routes necessárias (Phase 2–6)

| Route | Método | Fase | Auth | Validação especial |
|---|---|---|---|---|
| `app/(auth)/login/actions.ts` | Server Action | 2 | Público | signInWithPassword |
| `/api/leads/[id]/route.ts` | PATCH | 4 | Obrigatório | Zod: stage enum |
| `/api/leads/[id]/assign/route.ts` | POST | 4 | Obrigatório | assigned_to = auth.uid() |
| `/api/leads/[id]/pause/route.ts` | PATCH | 4 | Obrigatório | toggle automation_paused |
| `/api/leads/[id]/send-message/route.ts` | POST | 6 | Obrigatório | Zod: phone E.164 + text |
| `/api/meetings/route.ts` | GET + POST | 5 | Obrigatório | Zod: date, lead_id, user_id |
| `/api/meetings/[id]/route.ts` | PATCH + DELETE | 5 | Obrigatório | owner check |
| `/api/webhooks/whatsapp/route.ts` | GET + POST | 7 | Público | GET: hub.challenge; POST: HMAC SHA256 + timingSafeEqual |
| `/api/webhooks/n8n/route.ts` | POST | 7 | Bearer token N8N | Zod: stage + summary |

---

## Riscos críticos e mitigações

1. **Vazamento do `SUPABASE_SERVICE_ROLE_KEY`** — alliance-qa faz grep após cada fase; variável só em `src/app/api/**` e `src/lib/supabase/server.ts`

2. **Falha de HMAC no webhook Meta** — usar `request.text()` ANTES de `request.json()`; comparação com `crypto.timingSafeEqual`; testado como primeiro critério da Phase 7

3. **Race condition no Kanban (múltiplos usuários + Realtime)** — UPDATE usa `updated_at` para controle otimista; Realtime sobrescreve estado local após confirmação do banco

---

## Critérios de aceite consolidados

### Phase 1 — Design System
- [ ] `npm run dev` → splash em localhost:3000 com animação
- [ ] Splash redireciona para /login após 2.5s
- [ ] Login card flutua sobre blob azul inferior
- [ ] Todos os tokens Alliance em tailwind.config.ts (sem hardcode)
- [ ] `npm run build` limpo, zero erros TypeScript

### Phase 2 — Fundação
- [ ] Login com credenciais reais → redireciona /dashboard
- [ ] /dashboard sem login → redireciona /login
- [ ] 7 tabelas existem no Supabase com RLS ativo
- [ ] seed: 6 imóveis retornam em `SELECT * FROM imoveis`
- [ ] Build limpo

### Phase 3 — Dashboard
- [ ] 6 MetricCards com dados reais do Supabase
- [ ] 2 gráficos Chart.js com dados reais
- [ ] Saudação dinâmica com nome do usuário logado
- [ ] Skeleton de loading durante fetch
- [ ] Counter animado (spring) nos valores numéricos

### Phase 4 — Kanban
- [ ] 6 colunas com leads do Supabase
- [ ] Drag-and-drop persiste no banco
- [ ] Badge dinâmico com cor do consultor
- [ ] Modal abre com dados completos do lead
- [ ] Realtime: mover card em outra aba reflete em tempo real

### Phase 5 — Agenda
- [ ] Calendário mensal com navegação mês/ano
- [ ] Pills coloridos por consultor nos dias corretos
- [ ] Dialog de nova reunião cria registro no banco
- [ ] Mover card para "reuniao_agendada" no Kanban abre dialog pre-preenchido

### Phase 6 — Imóveis + Interações
- [ ] 6 unidades La Reserva com dados reais
- [ ] Chat estilo WhatsApp com mensagens inbound/outbound
- [ ] Realtime: mensagem recebida aparece sem refresh
- [ ] Input manual visível apenas quando `automation_paused = true`
- [ ] Scroll automático para última mensagem

---

## Decisões de arquitetura bloqueadas (não negociáveis)

1. App Router Next.js 14 — sem Pages Router
2. `SUPABASE_SERVICE_ROLE_KEY` somente em `src/app/api/**` e `src/lib/supabase/server.ts`
3. HMAC SHA256 validado ANTES de qualquer processamento no webhook Meta
4. `auth.getUser()` como PRIMEIRA operação em toda API route
5. Meta Cloud API oficial (graph.facebook.com) — sem Evolution API
6. Supabase Realtime — sem polling
7. TypeScript estrito sem `any`
8. shadcn/ui — nunca editar `src/components/ui/` manualmente
9. Framer Motion obrigatório em toda transição e modal
10. RLS ativo em todas as 7 tabelas
11. `interactions` imutável pelo cliente (sem UPDATE/DELETE)
12. Seed de imóveis no próprio 001_schema.sql (sem CRUD no v1)

---

## Estrutura de pastas (definitiva)

```
src/
  app/
    (auth)/login/page.tsx + actions.ts
    (protected)/
      layout.tsx                    ← NavShell + verifica sessão
      dashboard/page.tsx + loading.tsx
      kanban/page.tsx + loading.tsx
      agenda/page.tsx + loading.tsx
      imoveis/page.tsx
      interacoes/page.tsx
    api/
      leads/[id]/route.ts
      leads/[id]/assign/route.ts
      leads/[id]/pause/route.ts
      leads/[id]/send-message/route.ts
      meetings/route.ts
      meetings/[id]/route.ts
      webhooks/whatsapp/route.ts
      webhooks/n8n/route.ts
  components/
    layout/ (blob-bottom, blob-header, nav-shell, page-transition)
    dashboard/ (metric-card, metrics-grid, activity-chart)
    kanban/ (kanban-board, kanban-column, lead-card, lead-modal, alliance-badge)
    agenda/ (calendar-grid, meeting-pill, create-meeting-dialog)
    imoveis/ (imovel-card)
    interacoes/ (chat-sidebar, chat-area, message-bubble, send-input)
    ui/ ← shadcn/ui (nunca editar)
  lib/
    supabase/client.ts + server.ts + types.ts
    whatsapp/send.ts + templates.ts
    animations.ts
    utils/cn.ts + format.ts
  middleware.ts
```

---

## Plano aprovado por todos os especialistas: ✅ SIM
## Pronto para iniciar construção (Ralph mode): ✅ SIM
