# Roadmap: CRM Alliance — La Reserva
## Multi-Agente · GSD · Design System · WhatsApp Meta API

---

## Overview

Construção completa do CRM Alliance com orquestração multi-agente. O projeto começa criando os agentes especializados e fazendo um planejamento conjunto antes de qualquer código ser escrito. Cada agente tem função específica e responsabilidade clara. A execução usa waves paralelas onde possível.

**Ordem de milestone:**
1. Agentes criados + plano conjunto aprovado
2. Design system + fundação técnica
3. Páginas core (Dashboard, Kanban, Agenda)
4. Páginas secundárias (Imóveis, Interações/Chat)
5. Automação WhatsApp + IA com contexto completo
6. Deploy v1 sem disparos
7. Disparos em massa (última — só após validação em produção)

---

## Milestones

- 📋 **v0.0 Agentes + Plano** — Phase 0 (criar agentes, planejamento conjunto, aprovar)
- 📋 **v1.0 Design + Fundação** — Phases 1–2 (design system, banco, auth)
- 📋 **v1.1 Páginas Core** — Phases 3–5 (Dashboard, Kanban, Agenda)
- 📋 **v1.2 Chat + Imóveis** — Phase 6 (Interações estilo WhatsApp, catálogo)
- 📋 **v2.0 Automação** — Phase 7 (WhatsApp Meta API + agente IA com contexto)
- 📋 **v2.1 Deploy inicial** — Phase 8 (testes, segurança, produção sem disparos)
- 📋 **v3.0 Disparos + Deploy final** — Phase 9 (campanhas HSM, produção completa)

---

## Phases

- [ ] **Phase 0: Criar agentes + Planejamento conjunto** — Instalar agentes, rodar briefing paralelo, aprovar master plan
- [ ] **Phase 1: Design System** — Tokens, componentes base, blobs, splash, login
- [ ] **Phase 2: Fundação** — Schema Supabase (executado pelo agente), auth, middleware
- [ ] **Phase 3: Dashboard** — Métricas, gráficos de barras, saudação
- [ ] **Phase 4: Kanban** — Pipeline drag-and-drop, modal, badges dinâmicos
- [ ] **Phase 5: Agenda** — Calendário com pills coloridos por consultor
- [ ] **Phase 6: Imóveis + Interações** — Catálogo La Reserva + chat estilo WhatsApp
- [ ] **Phase 7: WhatsApp + IA** — Webhook Meta, N8N, agente com contexto completo
- [ ] **Phase 8: Deploy v1** — Auditoria, testes, produção sem disparos
- [ ] **Phase 9: Disparos + Deploy final** — Templates HSM, campanhas, produção completa

---

## Phase Details

### Phase 0: Criar Agentes + Planejamento Conjunto
**Goal**: Todos os 7 agentes especializados criados em `.claude/agents/`, planejamento conjunto executado com todos os especialistas e MASTER-PLAN.md aprovado pelo usuário antes de qualquer código.
**Depends on**: Nothing (first phase)
**Skills**: `get-shit-done` (orchestration) · `coding-standards` · `strategic-compact`
**Requirements**: [AGENT-01, AGENT-02, AGENT-03, PLAN-01, PLAN-02]
**Success Criteria** (what must be TRUE):
  1. Pasta `.claude/agents/` existe com 7 arquivos `.md` de agentes
  2. Cada agente tem: name, description, tools, color e role claros no frontmatter
  3. alliance-planner spawnou todos os especialistas em paralelo e coletou briefings
  4. `.planning/MASTER-PLAN.md` existe com wave map, dependências e critérios de aceite
  5. Usuário aprovou o MASTER-PLAN.md antes de avançar
**Plans**: 2 plans

Plans:
- [ ] 00-01: Criar pasta .claude/agents/ + copiar os 7 arquivos de agente + criar .planning/
- [ ] 00-02: Spawnar alliance-planner → rodadas de planejamento → apresentar MASTER-PLAN.md → aguardar aprovação

---

### Phase 1: Design System
**Goal**: Design system completo fiel ao Figma — tokens de cor, tipografia, componentes base, blobs SVG, splash screen e tela de login com animações Framer Motion.
**Depends on**: Phase 0 (plano aprovado)
**Skills**: `ui-ux` · `frontend-patterns` · `coding-standards`
**Agents**: `alliance-design` (UI-SPEC) + `alliance-frontend` (implementação) + `alliance-qa` (verificação)
**Requirements**: [DS-01, DS-02, DS-03, DS-04, DS-05]
**Success Criteria** (what must be TRUE):
  1. User runs `npm run dev` and sees animated splash screen at localhost:3000
  2. Splash → Login transition is smooth (Framer Motion, 0.4s)
  3. Login card floats over the blue semicircle blob — identical to Figma
  4. tailwind.config.ts has all Alliance tokens (alliance.blue #1E90FF, alliance.dark #0A2EAD, etc.)
  5. NavShell renders with blob header, logo, and active nav pill
  6. All base components exist: BlobBottom, BlobHeader, NavShell, AllianceBadge, AllianceCard, PageTransition
**Plans**: 3 plans

Plans:
- [ ] 01-01: Next.js setup + todas as dependências + tailwind tokens Alliance + shadcn/ui
- [ ] 01-02: Componentes base (BlobBottom, BlobHeader, NavShell, AllianceBadge, AllianceCard, PageTransition)
- [ ] 01-03: Splash screen + tela de login (visual + animações, sem auth real ainda)

---

### Phase 2: Fundação (Banco + Auth)
**Goal**: Banco Supabase com schema completo executado pelo agente alliance-db (sem intervenção manual do usuário), auth funcional conectado ao login da Fase 1.
**Depends on**: Phase 1
**Skills**: `security-review` · `backend-patterns` · `coding-standards`
**Agents**: `alliance-db` (banco) + `alliance-backend` (auth/middleware) + `alliance-qa` (verificação)
**Requirements**: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, DB-01, DB-02, DB-03]

### Como o agente executa o schema (sem pedir ao usuário)

O agente `alliance-db` usa a API REST do Supabase para executar o SQL diretamente:

```typescript
// Método 1: via Supabase Management API
// POST https://api.supabase.com/v1/projects/{ref}/database/query
// Header: Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}

// Método 2: via supabase-js com rpc (se disponível)
const { error } = await supabase.rpc('exec_sql', { sql: schemaContent })

// Método 3: executar SQL em partes via .from() queries sequenciais
// (para CREATE TABLE, CREATE POLICY, etc.)
```

Se nenhum método funcionar via API, o agente usa o Supabase CLI:
```bash
npx supabase db push --db-url "${DATABASE_URL}"
# ou
cat 001_schema.sql | npx supabase sql --db-url "${DATABASE_URL}"
```

**Success Criteria** (what must be TRUE):
  1. All 7 database tables exist in Supabase (verified by SELECT query)
  2. RLS is active on all tables (verified by querying pg_tables)
  3. Login with real credentials works and redirects to /dashboard
  4. Unauthenticated requests redirect to /login
  5. `npm run build` passes with zero errors
**Plans**: 3 plans

Plans:
- [ ] 02-01: Supabase clients (client.ts + server.ts) + types.ts + testar conectividade
- [ ] 02-02: alliance-db executa 001_schema.sql via API + valida RLS + seed de imóveis
- [ ] 02-03: Auth Server Action + middleware de proteção de rotas + conectar login ao Supabase Auth real

---

### Phase 3: Dashboard
**Goal**: Dashboard com 6 cards de métricas, 2 gráficos de barras e saudação — visual idêntico ao Figma, dados reais do Supabase.
**Depends on**: Phase 2
**Skills**: `ui-ux` · `frontend-patterns` · `verification-loop`
**Agents**: `alliance-design` (UI-SPEC) + `alliance-frontend` (implementação) + `alliance-qa` (verificação)
**Requirements**: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06]
**Success Criteria** (what must be TRUE):
  1. User sees greeting "BEM-VINDO, [nome]!" in alliance-blue bold
  2. 6 metric cards in 2×3 grid: Leads (dark blue), Reuniões, Sem resposta, Aquecidos, Pausadas, Disponíveis (dark blue)
  3. Two bar charts side by side: "reunião" and "leads" — bars in #1E90FF
  4. All data loads from Supabase (no mocked values)
  5. Skeleton loading shows while data fetches
  6. Metric counters animate from 0 to value on load (Framer Motion spring)
**Plans**: 3 plans

Plans:
- [ ] 03-01: Layout + MetricCard (variantes featured/default) + MetricsGrid + skeleton
- [ ] 03-02: ActivityChart (2 gráficos de barras Chart.js) + animação de entrada
- [ ] 03-03: Conectar queries Supabase + saudação dinâmica + dados reais

---

### Phase 4: Kanban
**Goal**: Pipeline com 6 colunas drag-and-drop, cards com badges dinâmicos (IA/consultor com cor do banco), modal de detalhes fiel ao Figma e Realtime para múltiplos usuários.
**Depends on**: Phase 2
**Skills**: `ui-ux` · `frontend-patterns` · `verification-loop`
**Agents**: `alliance-design` (UI-SPEC) + `alliance-frontend` (implementação) + `alliance-backend` (API routes) + `alliance-qa` (verificação)
**Requirements**: [KBAN-01, KBAN-02, KBAN-03, KBAN-04, KBAN-05, KBAN-06, KBAN-07, KBAN-08]
**Success Criteria** (what must be TRUE):
  1. 6 columns visible with colored icons: Lead Frio (blue), Lead Morno (orange), Lead Quente (red), Reunião Agendada (green), Follow Up, Visita Confirmada
  2. Dragging a card to new column updates `stage` in Supabase instantly
  3. Card badge shows "agente de IA" (dark blue) when unassigned OR consultant name in their badge_color when assigned
  4. Clicking a card opens the detail modal matching Figma: name, phone, city, imóvel, intenção, tempo, resumo
  5. "Assumir conversa" button assigns logged user and changes badge color
  6. "Pausar automação" toggle works and shows pause state on card
  7. Two browser tabs: moving a card in one updates the other in real time
**Plans**: 4 plans

Plans:
- [ ] 04-01: KanbanBoard (DnD context) + KanbanColumn (6 colunas) + buscar leads do Supabase
- [ ] 04-02: LeadCard (draggable, badge dinâmico via badge_color do banco) + Supabase Realtime
- [ ] 04-03: Modal de detalhes fiel ao Figma + animação de entrada/saída
- [ ] 04-04: AssignButton + PauseButton + API routes (/assign, /pause) + botões Etiquetas/Novo Lead

---

### Phase 5: Agenda
**Goal**: Calendário mensal com pills coloridos por consultor (cor do badge_color do banco), navegação por mês/ano e sincronização com Kanban.
**Depends on**: Phase 4
**Skills**: `ui-ux` · `frontend-patterns`
**Agents**: `alliance-design` (UI-SPEC) + `alliance-frontend` (implementação) + `alliance-qa` (verificação)
**Requirements**: [AGND-01, AGND-02, AGND-03, AGND-04, AGND-05]
**Success Criteria** (what must be TRUE):
  1. Monthly calendar with Portuguese day abbreviations (seg, ter, qua...)
  2. Today's cell has alliance-blue background
  3. Meeting pills show in consultant's badge_color from database
  4. Moving Kanban card to "Reunião Agendada" opens meeting creation dialog with lead pre-filled
  5. Meetings created anywhere appear in the calendar immediately
**Plans**: 3 plans

Plans:
- [ ] 05-01: Layout calendário mensal + cells de dias em português + célula hoje destacada
- [ ] 05-02: Meeting pills com cor do consultor (busca user_profiles.badge_color) + seletores mês/ano
- [ ] 05-03: CreateMeetingDialog + sync Kanban → Agenda + API routes de meetings

---

### Phase 6: Imóveis + Interações (Chat WhatsApp)
**Goal**: Catálogo das 6 unidades do La Reserva e interface de chat estilo WhatsApp com histórico em tempo real, sidebar de leads e envio manual de mensagens.
**Depends on**: Phase 4 (leads e interactions existem no banco)
**Skills**: `ui-ux` · `frontend-patterns` · `backend-patterns`
**Agents**: `alliance-design` (UI-SPEC) + `alliance-frontend` (implementação) + `alliance-backend` (send-message) + `alliance-qa` (verificação)
**Requirements**: [IMOV-01, IMOV-02, INAT-01, INAT-02, INAT-03, INAT-04, INAT-05, INAT-06]
**Success Criteria** (what must be TRUE):

*Imóveis:*
  1. 6 unit cards: Apto 01 (146m²), Apto 02 (90,80m²), Apto 03 (110,85m²), Apto 04 (144,80m²), Cobertura 01 (245,60m²), Cobertura 02 (259,95m²)
  2. Each card shows metragem, quartos, suítes, diferenciais, faixa de valor, disponibilidade

*Interações (Chat):*
  3. Sidebar (dark blue #0A2EAD) with lead list ordered by last interaction
  4. Active lead highlighted in alliance-blue (#1E90FF)
  5. Chat header: dark blue bg, lead name + phone + IA/pause icons
  6. Inbound messages: blue pills (#1E90FF) left-aligned
  7. Outbound IA messages: white cards right-aligned + "agente de IA" badge below
  8. New messages appear in real time via Supabase Realtime (no reload)
  9. Manual send input visible only when automation_paused = true
  10. Sending manual message calls Meta API (sendTextMessage) via /api/leads/{id}/send-message
**Plans**: 3 plans

Plans:
- [ ] 06-01: Página Imóveis — 6 cards das unidades La Reserva com dados do banco
- [ ] 06-02: Layout Interações — sidebar dark + área de chat + Realtime (estilo WhatsApp)
- [ ] 06-03: Envio manual de mensagem (API route → Meta API) + scroll automático + estados

---

### Phase 7: WhatsApp Meta API + Agente IA com Contexto
**Goal**: Webhook Meta validado com HMAC, N8N orquestrando o agente com contexto completo do lead (name, stage, intention, imovel, summary, histórico) e CRM atualizado em tempo real.
**Depends on**: Phase 2 (banco), Phase 4 (Kanban para ver resultado)
**Skills**: `backend-patterns` · `security-review` · `coding-standards`
**Agents**: `alliance-backend` (webhook + send) + `alliance-qa` (verificação) + `alliance-debug` (se necessário)
**Requirements**: [WHTS-01, WHTS-02, WHTS-03, WHTS-04, WHTS-05, WHTS-06, WHTS-07]

### Contexto enviado ao agente (resolve problema da versão anterior)
```
CONTEXTO DO LEAD:
- Nome: {name}
- Estágio: {stage}
- Intenção: {intention}
- Imóvel de interesse: {imovel_interesse}
- Nº de interações: {interaction_count}
- Consultor: {assigned_to_name} | "agente de IA"
- Cidade: {city}
- Resumo: {summary}  ← atualizado pela IA após cada resposta

HISTÓRICO (últimas 10 msgs):
[inbound/outbound alternados]

MENSAGEM ATUAL: {message}
[PROMPT LA RESERVA COMPLETO]
```

**Success Criteria** (what must be TRUE):
  1. GET /api/webhooks/whatsapp responds to Meta hub.challenge correctly
  2. POST rejects requests with invalid X-Hub-Signature-256 with 403
  3. New WhatsApp message creates lead with stage `lead_frio` in Supabase
  4. AI response references lead's name and stage-appropriate content (context working)
  5. `automation_paused = true` completely stops AI for that lead
  6. Every message saved to interactions with wa_message_id
  7. `summary` field updated after each AI response
  8. Stage advances: ≥5 interactions → lead_morno, ≥10 → lead_quente
**Plans**: 3 plans

Plans:
- [ ] 07-01: API route webhook Meta (GET + POST + HMAC SHA256 + repassar ao N8N)
- [ ] 07-02: Documentação do fluxo N8N com contexto completo + lib/whatsapp/send.ts
- [ ] 07-03: API route sync N8N → CRM (/api/webhooks/n8n) + update summary + teste end-to-end

---

### Phase 8: Deploy v1 (sem disparos)
**Goal**: Sistema auditado por todos os agentes, testado pelos 5 usuários Alliance e rodando em produção.
**Depends on**: Phase 7
**Skills**: `verification-loop` · `security-review` · `strategic-compact`
**Agents**: `alliance-qa` + `alliance-design` (audit visual) + `gsd-integration-checker` + `alliance-debug` (se necessário)
**Requirements**: [SEC-01, SEC-02, SEC-03, DEPL-01, DEPL-02, DEPL-03]
**Success Criteria** (what must be TRUE):
  1. All 5 users tested all pages without critical bugs
  2. Visual design matches Figma on all pages
  3. Frontend deployed on Vercel with custom domain
  4. N8N deployed on Railway with stable uptime
  5. Meta webhook on production URL, passing verification
  6. `npm run build`, `tsc --noEmit`, `lint` — all zero errors
**Plans**: 3 plans

Plans:
- [ ] 08-01: Auditoria de segurança completa (alliance-qa + security-reviewer) + correções
- [ ] 08-02: UAT com os 5 usuários + roteiro de testes + alliance-debug para bugs
- [ ] 08-03: Deploy Vercel + Railway (N8N) + webhook Meta produção + smoke test

---

### Phase 9: Disparos + Deploy Final
**Goal**: Módulo de campanhas HSM com upload CSV, templates Meta e progresso ao vivo — sistema completo v3.0 em produção.
**Depends on**: Phase 8 (sistema validado em produção)
**Skills**: `ui-ux` · `frontend-patterns` · `backend-patterns` · `security-review`
**Agents**: Todos os agentes ativos em suas funções
**Requirements**: [DISP-01, DISP-02, DISP-03, DISP-04, DISP-05]
**Success Criteria** (what must be TRUE):
  1. ADM only can start broadcasts (verified at route level)
  2. CSV upload validates E.164 format with preview of valid/invalid numbers
  3. Templates fetched live from Meta API and rendered with variable preview
  4. Progress bar updates in real time showing sent/failed per number
  5. System complete v3.0 deployed and operational
**Plans**: 3 plans

Plans:
- [ ] 09-01: Página Disparos + CSV upload (papaparse) + validação E.164 + preview
- [ ] 09-02: TemplateSelector (Meta API) + TemplatePreview + API route de disparo + Realtime progress
- [ ] 09-03: Deploy final + smoke test com template real + documentação para a equipe

---

## Design System — Fonte da Verdade Visual

> Lida por alliance-design antes de qualquer UI-SPEC.md.
> Lida por alliance-frontend antes de qualquer componente.

### Paleta de cores (tokens Tailwind)
```
alliance.blue:  #1E90FF  ← azul vivo | títulos, pills inbound, CTAs secundários
alliance.dark:  #0A2EAD  ← azul escuro | sidebar, cards featured, botão entrar
alliance.mid:   #1565C0  ← azul médio | blob do header/nav
alliance.card:  #F0F0F0  ← cards secundários do dashboard
alliance.col:   #E8E8E8  ← fundo das colunas do kanban
alliance.input: #D9D9D9  ← campos de input
alliance.chat:  #CCCCCC  ← área de chat nas interações

badge.joao:   #FF6B00  ← consultor João
badge.mateus: #3D3D3D  ← consultor Mateus (default para novos corretores)
badge.ia:     #0A2EAD  ← agente de IA
badge.quente: #FF4500  ← lead quente
badge.morno:  #FF8C00  ← lead morno
badge.frio:   #1E90FF  ← lead frio
```

### Blobs/semicírculos (clip-path CSS)
```css
.blob-bottom { clip-path: ellipse(75% 100% at 50% 100%); background: #1E90FF; }
.blob-header { clip-path: ellipse(60% 100% at 100% 0%); background: #1565C0; }
```

### Animações Framer Motion (padrão obrigatório)
```typescript
export const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: 'easeOut' }
}
export const modalAnimation = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: 'easeOut' }
}
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } }
}
export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 }
}
export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.15 } }
}
export const dragCard = {
  whileDrag: { scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }
}
```

---

## Schema do Banco

Arquivo: `001_schema.sql` (executado pelo agente `alliance-db` na Fase 2)

7 tabelas: `user_profiles`, `leads`, `interactions`, `meetings`, `broadcasts`, `broadcast_numbers`, `imoveis`

Campos críticos adicionados vs v1:
- `leads.city` — cidade identificada pela IA
- `leads.imovel_interesse` — unidade de interesse identificada pela IA
- `leads.summary` — resumo gerado e atualizado pela IA após cada resposta
- `user_profiles.badge_color` — cor hex do badge do consultor (dinâmica no Kanban)
- `imoveis` — tabela com as 6 unidades do La Reserva (seed no schema)

---

## Variáveis de Ambiente

```bash
NEXT_PUBLIC_SUPABASE_URL=https://lmvdruvmpybutmmidrfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # anon key do painel
SUPABASE_SERVICE_ROLE_KEY=            # ⚠️ somente server-side
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
```

---

## Obsidian — Cérebro do Projeto

O Obsidian funciona como a memória persistente do projeto. Todo agente que conclui uma tarefa relevante escreve uma nota no vault. Isso garante que o contexto nunca se perde entre sessões, mesmo que o Claude Code seja reiniciado.

### Configuração inicial (Phase 0 — antes do planejamento)

O agente `alliance-planner` executa esta configuração uma única vez:

**Passo 1 — Descobrir o caminho do vault:**
```bash
# macOS — localizar vaults do Obsidian
find ~/Library/Application\ Support/obsidian -name "*.json" 2>/dev/null | head -5
# Ou procurar em locais comuns:
ls ~/Documents/ | grep -i obsid
ls ~/Desktop/ | grep -i obsid
ls ~/ | grep -i obsid
```

**Passo 2 — Confirmar com o usuário:**
Se o vault não for encontrado automaticamente, pausar e perguntar:
```
"⏸ Onde está o seu vault do Obsidian?
 Ex: /Users/seu-nome/Documents/MeuVault
 
 Responda com o caminho completo da pasta."
```

**Passo 3 — Criar estrutura de notas no vault:**
```bash
VAULT_PATH="[caminho confirmado]"

mkdir -p "${VAULT_PATH}/CRM Alliance"
mkdir -p "${VAULT_PATH}/CRM Alliance/Fases"
mkdir -p "${VAULT_PATH}/CRM Alliance/Agentes"
mkdir -p "${VAULT_PATH}/CRM Alliance/Decisões"
mkdir -p "${VAULT_PATH}/CRM Alliance/Erros"
```

**Passo 4 — Criar nota índice:**
```bash
cat > "${VAULT_PATH}/CRM Alliance/INDEX.md" << 'EOF'
# CRM Alliance — Índice

## Links rápidos
- [[Progresso]] — status atual de todas as fases
- [[Decisões]] — decisões técnicas tomadas
- [[Erros]] — problemas encontrados e resolvidos
- [[Design System]] — tokens, componentes, animações

## Fases
- [[Fase 0 — Agentes e Planejamento]]
- [[Fase 1 — Design System]]
- [[Fase 2 — Fundação]]
- [[Fase 3 — Dashboard]]
- [[Fase 4 — Kanban]]
- [[Fase 5 — Agenda]]
- [[Fase 6 — Imóveis e Interações]]
- [[Fase 7 — WhatsApp e IA]]
- [[Fase 8 — Deploy v1]]
- [[Fase 9 — Disparos e Deploy Final]]
EOF
```

**Passo 5 — Salvar caminho do vault em `.planning/obsidian.config`:**
```bash
echo "VAULT_PATH=${VAULT_PATH}/CRM Alliance" > .planning/obsidian.config
```

Todos os agentes leem este arquivo para saber onde escrever.

---

### O que cada agente registra no Obsidian

#### alliance-planner — ao concluir o planejamento conjunto
Arquivo: `Fases/Fase 0 — Agentes e Planejamento.md`
```markdown
# Fase 0 — Agentes e Planejamento
**Data:** [data]
**Status:** Concluído

## Agentes criados
- alliance-architect, alliance-db, alliance-design, alliance-frontend,
  alliance-backend, alliance-qa, alliance-debug, alliance-planner

## Resumo do MASTER-PLAN
[síntese do que cada especialista identificou]

## Decisões tomadas nesta fase
- [decisão] — [motivo]

## Wave map aprovado
[mapa de execução paralela]
```

#### alliance-architect — ao produzir ARCHITECTURE-DECISIONS.md
Arquivo: `Decisões/Arquitetura.md`
```markdown
# Decisões de Arquitetura
**Aprovado em:** [data]

## Decisões bloqueadas
- [decisão] — [motivo] — impacto: [alto/médio/baixo]

## Riscos identificados
- [risco] — mitigação: [como foi tratado]

## Ajustes ao schema
- [ajuste] — [motivo]
```

#### alliance-design — ao criar cada UI-SPEC.md
Arquivo: `Fases/Fase N — [Nome]/UI-SPEC-resumo.md`
```markdown
# Design — Fase N
**Data:** [data]

## Componentes criados
- [ComponenteName] — props: [...] — animação: [...]

## Tokens utilizados
- [token] → [valor] → [onde foi usado]

## Decisões de design
- [decisão] — [motivo]

## Status visual
✅ Aprovado / ⚠️ Pendente ajuste
```

#### alliance-frontend e alliance-backend — ao concluir cada plan
Arquivo: `Fases/Fase N — [Nome]/[plan-id]-resumo.md`
```markdown
# Plan [N-N] — [Nome]
**Agente:** [alliance-frontend / alliance-backend]
**Concluído em:** [data]

## O que foi criado
- [arquivo] — [o que faz]

## Decisões técnicas
- [decisão] — [alternativas consideradas] — [motivo da escolha]

## Próxima dependência
[o que a próxima fase precisa deste plan]
```

#### alliance-qa — ao verificar cada fase
Arquivo: `Fases/Fase N — [Nome]/QA.md`
```markdown
# QA — Fase N
**Data:** [data]

## Resultado
Build: ✅/❌ | TypeScript: ✅/❌ | Lint: ✅/❌ | Segurança: ✅/❌

## Problemas encontrados
- [problema] → [arquivo] → [resolvido por alliance-debug: sim/não]

## Veredito
✅ APROVADO — avançar para Fase N+1
⚠️ BLOQUEADO — [motivo]
```

#### alliance-debug — ao resolver cada erro
Arquivo: `Erros/[data]-[slug-do-erro].md`
```markdown
# Erro: [descrição curta]
**Fase:** [N] | **Data:** [data] | **Resolvido:** sim/não

## Sintoma
[o que apareceu no terminal ou no browser]

## Causa raiz
[o que realmente causou — não apenas o sintoma]

## Fix aplicado
[mudança exata feita]

## Como evitar no futuro
[lição aprendida]
```

---

### Nota de progresso global — atualizada após cada fase

O `alliance-qa` atualiza este arquivo ao aprovar cada fase:

Arquivo: `Progresso.md`
```markdown
# Progresso — CRM Alliance

| Fase | Status | Concluída em | Notas |
|------|--------|--------------|-------|
| 0. Agentes + Plano | ✅ | [data] | [link] |
| 1. Design System | ✅ | [data] | [link] |
| 2. Fundação | 🚧 | - | em andamento |
| 3. Dashboard | 📋 | - | - |
...

**Última atualização:** [data e hora]
**Fase atual:** [N]
**Próximo passo:** [descrição]
```

---

### Como os agentes escrevem no Obsidian

Todo agente usa este padrão ao final de cada tarefa relevante:

```bash
# Ler caminho do vault
source .planning/obsidian.config 2>/dev/null

# Escrever nota (criar ou sobrescrever)
cat > "${VAULT_PATH}/[caminho-da-nota].md" << 'NOTA'
[conteúdo da nota em markdown]
NOTA

echo "✓ Obsidian atualizado: ${VAULT_PATH}/[caminho-da-nota].md"
```

Se `.planning/obsidian.config` não existir (vault não configurado ainda),
o agente pula a escrita no Obsidian e registra apenas em `.planning/`.

---

## Progress

| Phase | Milestone | Agents | Plans | Status |
|-------|-----------|--------|-------|--------|
| 0. Agentes + Plano | v0.0 | alliance-planner | 0/2 | Not started |
| 1. Design System | v1.0 | alliance-design + alliance-frontend + alliance-qa | 0/3 | Not started |
| 2. Fundação | v1.0 | alliance-db + alliance-backend + alliance-qa | 0/3 | Not started |
| 3. Dashboard | v1.1 | alliance-design + alliance-frontend + alliance-qa | 0/3 | Not started |
| 4. Kanban | v1.1 | alliance-design + alliance-frontend + alliance-backend + alliance-qa | 0/4 | Not started |
| 5. Agenda | v1.1 | alliance-design + alliance-frontend + alliance-qa | 0/3 | Not started |
| 6. Imóveis + Interações | v1.2 | alliance-design + alliance-frontend + alliance-backend + alliance-qa | 0/3 | Not started |
| 7. WhatsApp + IA | v2.0 | alliance-backend + alliance-qa + alliance-debug | 0/3 | Not started |
| 8. Deploy v1 | v2.1 | alliance-qa + alliance-debug | 0/3 | Not started |
| 9. Disparos + Deploy final | v3.0 | todos | 0/3 | Not started |
