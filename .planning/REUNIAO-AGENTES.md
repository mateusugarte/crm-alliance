# 🛋️ Reunião dos Agentes — CRM Alliance
> Data: 28/03/2026 | Todos os agentes no sofá | Moderação: alliance-planner

---

## Presentes

| Agente | Cor | Função |
|--------|-----|--------|
| 🏗️ alliance-architect | `#1D4ED8` | Arquitetura, segurança, backend |
| 🎨 alliance-design | `#E879F9` | UI/UX, design system, animações |
| ⚛️ alliance-frontend | `#EC4899` | React, componentes, estado |
| 🔧 alliance-backend | `#0891B2` | API routes, webhooks, integração |
| 🗄️ alliance-db | `#059669` | Banco, RLS, migrations |
| ✅ alliance-qa | `#D97706` | Qualidade, build, segurança |
| 🐛 alliance-debug | `#DC2626` | Debug, causa raiz, fixes |
| 🧭 alliance-planner | `#7C3AED` | Planejamento, orquestração |

---

## 🎨 Fala: alliance-design

> *"Olha, tem coisa boa no que foi construído — a estrutura está certa, os tokens existem. Mas há divergências sérias entre o design system do CLAUDE.md e o que está rodando."*

### Problemas visuais encontrados

| Prioridade | Arquivo | Problema |
|---|---|---|
| 🔴 | `kanban-column.tsx:21` | Fundo `#F9FAFB` hardcoded — deveria ser `alliance.col` (`#E8E8E8`) |
| 🔴 | `lead-card.tsx:34` | `div` puro em vez de `motion.div` — sem drag + hover do design system |
| 🔴 | `chat-area.tsx:30` | Fundo `#F4F6F9` — deveria ser `alliance.chat` (`#CCCCCC`) |
| 🟡 | `nav-shell.tsx:45` | `relative` faltando no Link — indicador lateral desposicionado |
| 🟡 | `dashboard/page.tsx:111` | Saudação em dois elementos separados — deveria ser `"BEM-VINDO, NOME!"` bold em `alliance-blue` |
| 🟡 | `lead-detail-modal.tsx` | `style={{ backgroundColor: '#0A2EAD' }}` inline — viola tokens |

### Micro-interações faltando (baixo esforço, alto impacto)

```
✗  Sem cursor-pointer consistente em todos os clicáveis
✗  Sem focus-visible ring nos inputs e botões
✗  Sem disabled state visual nos botões durante loading
✗  Sem tooltip nos botões com só ícone (pausar, assumir)
✗  Sem AnimatePresence no input de envio do chat
✗  Sem staggerChildren nos cards do Kanban ao carregar
✗  Sem transição de cor no badge ao mudar de stage
✗  Sem skeleton no carregamento da sidebar de Interações
```

### Novas features de UI (complexas)

```
1. Contador animado nos metric cards (0 → valor, spring animation)
2. Notificação no nav (badge vermelho quando lead muda de stage)
3. Confetti / pulse suave ao mover lead para "Visita Confirmada"
4. Status indicator "online" nos consultores na sidebar do chat
5. Progress ring no lead mostrando % do funil concluído
```

---

## ⚛️ Fala: alliance-frontend

> *"Vou direto ao ponto: tem dois bugs que bloqueiam uso em produção. O botão 'Assumir' não faz nada. As mensagens manuais somem após envio."*

### Bugs críticos (bloqueadores de produção)

| # | Bug | Arquivo | Impacto |
|---|-----|---------|---------|
| BUG-01 | `onAssume={() => {}}` — botão Assumir é um no-op | `kanban-board.tsx:63` | Nenhum corretor consegue assumir lead pelo modal |
| BUG-02 | `setMessages` descartado — mensagem manual some sem reload | `interacoes-client.tsx` | Chat inútil para envio manual |
| BUG-03 | `tempoNoStage` usa `updated_at` — muda em qualquer update | `lead-detail-modal.tsx:43` | Métrica inválida |
| BUG-04 | `interaction_count` sem fallback — exibe "null interações" | `lead-detail-modal.tsx:104` | Quebra visual |

### States faltando por página

```
/dashboard    → skeleton no MetricsGrid já existe ✅ | gráficos sem skeleton ❌
/kanban       → sem empty state global (nenhum lead no sistema)
/agenda       → sem loading state, sem empty state por mês
/imoveis      → sem estado de erro (falha Supabase)
/interacoes   → sem skeleton na sidebar, sem "nenhuma mensagem" no chat
```

### Features de interação faltando

```
✗  Busca/filtro por nome no Kanban (muito pedida por corretores)
✗  Busca por nome na sidebar de Interações
✗  Filtro por consultor nas colunas do Kanban
✗  Atalho Esc para fechar o Sheet do lead
✗  Scroll automático para última mensagem ao abrir chat
✗  Indicador "digitando..." durante envio de mensagem
✗  Pull-to-refresh no mobile
```

### Realtime — gap crítico

```
Kanban:  DnD funciona localmente, mas 2 abas NÃO sincronizam → Supabase Realtime ausente
Chat:    Novas mensagens chegam pelo WhatsApp mas só aparecem após reload manual
```

---

## 🏗️ Fala: alliance-architect

> *"Tenho boas e más notícias. As boas: a estrutura de APIs está correta. As más: há um buraco de segurança crítico que não pode ir para produção."*

### O que está produção-ready ✅

```
✅ 8 API routes com auth como primeira operação
✅ lib/whatsapp/send.ts estruturado corretamente
✅ Schema SQL com RLS nas 7 tabelas
✅ Webhook WhatsApp com validação HMAC (GET + POST)
✅ Tipos TypeScript atualizados com tabela imoveis
```

### Bugs críticos de segurança 🔴

| # | Problema | Arquivo | Risco |
|---|---------|---------|-------|
| SEC-01 | **`middleware.ts` NÃO EXISTE** | — | Rotas protegidas acessíveis sem auth no servidor |
| SEC-02 | Webhook WhatsApp: fail-open se `WHATSAPP_APP_SECRET` ausente | `webhooks/whatsapp/route.ts` | Qualquer POST é aceito em produção |
| SEC-03 | Webhook N8N usa `ANON_KEY` — RLS bloqueia updates silenciosamente | `webhooks/n8n/route.ts` | IA não consegue atualizar leads sem `assigned_to` |
| SEC-04 | `send-message` duplica lógica do `lib/whatsapp/send.ts` com `catch {}` vazio | `leads/[id]/send-message` | Falhas na Meta API são silenciadas |

### APIs faltando para completar o sistema

```
GET  /api/interactions/[leadId]    → Chat abre vazio sem isso (Realtime só entrega futuros)
POST /api/leads                    → N8N não consegue criar leads novos
GET  /api/leads?search=            → Busca no Kanban e Interações
GET  /api/templates                → Phase 9: templates Meta para disparos
POST /api/broadcasts               → Phase 9: envio em massa
```

### Arquitetura Realtime (como implementar)

```typescript
// Kanban — adicionar em kanban-board.tsx
useEffect(() => {
  const channel = supabase
    .channel('leads-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },
      (payload) => setLeads(prev => /* merge payload */))
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [])

// Chat — adicionar em interacoes-client.tsx
useEffect(() => {
  const channel = supabase
    .channel(`interactions-${leadId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interactions',
      filter: `lead_id=eq.${leadId}` },
      (payload) => setMessages(prev => [...prev, payload.new as Interaction]))
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [leadId])
```

---

## 🧭 Fala: alliance-planner (síntese)

> *"Temos consenso. Os agentes identificaram 3 camadas de trabalho. Vou propor a ordem de execução."*

---

# 📋 PRÓXIMOS PASSOS — Plano Aprovado

## Camada 1: Correções Críticas (fazer ANTES de qualquer nova feature)

> Estimativa: 1 sessão de trabalho

### Wave A — Segurança (não pode ir a produção sem isso)
```
[ ] SEC-01: Criar src/middleware.ts com proteção de rotas
[ ] SEC-02: Webhook WhatsApp — fail-safe se APP_SECRET ausente
[ ] SEC-03: Webhook N8N — usar SERVICE_ROLE_KEY (server-side)
[ ] SEC-04: send-message — usar lib/whatsapp/send.ts, não duplicar
```

### Wave B — Bugs de UI (paralelo à Wave A)
```
[ ] BUG-01: Implementar onAssume em kanban-board.tsx (chamar /api/leads/[id]/assign)
[ ] BUG-02: Corrigir setter de mensagens em interacoes-client.tsx
[ ] BUG-03: tempoNoStage — criar campo stage_changed_at na DB ou calcular de interactions
[ ] Design tokens — substituir hardcodes por tokens Tailwind (3 arquivos)
```

---

## Camada 2: Visual & UX (o que faz o sistema parecer premium)

> Estimativa: 2–3 sessões

### Wave C — Micro-interações (baixo esforço, alto impacto)
```
[ ] cursor-pointer consistente em todos os clicáveis do sistema
[ ] focus-visible ring em todos os inputs e botões (acessibilidade)
[ ] Tooltip nos botões icon-only (Pausar IA, Assumir, etc.)
[ ] disabled + spinner nos botões durante fetch (loading state)
[ ] Esc fecha Sheet do lead (KeyboardEvent listener)
[ ] AnimatePresence no input do chat (aparece/some com animação)
[ ] Scroll automático para última mensagem ao abrir chat (useEffect + scrollIntoView)
```

### Wave D — Animações e Polimento
```
[ ] motion.div no lead-card com dragAnimation + cardHover do design system
[ ] staggerChildren nos cards ao carregar cada coluna do Kanban
[ ] Contadores animados nos metric cards (0 → valor, spring)
[ ] Transição de cor suave no badge de stage (color transition 0.3s)
[ ] Skeleton para gráficos do dashboard
[ ] Skeleton para sidebar de Interações
```

### Wave E — States Faltantes
```
[ ] Empty state global no Kanban (nenhum lead ainda)
[ ] Empty state no chat (nenhuma mensagem ainda)
[ ] Empty state por mês na Agenda
[ ] Error state em todas as páginas (Supabase offline)
[ ] Estado "nenhum resultado" nos filtros/busca
```

---

## Camada 3: Novas Features

> Estimativa: 4–6 sessões

### Realtime (alta prioridade — necessário para múltiplos corretores)
```
[ ] Supabase Realtime no Kanban — cards atualizam entre abas em tempo real
[ ] Supabase Realtime no Chat — mensagens aparecem sem reload
[ ] GET /api/interactions/[leadId] — chat carrega histórico completo
```

### Busca e Filtro (muito pedido pelos corretores)
```
[ ] Barra de busca por nome no Kanban (filter local, sem API)
[ ] Filtro por consultor (dropdown com cores dos badges)
[ ] Filtro por stage (multi-select pill)
[ ] Busca por nome na sidebar de Interações
```

### Notificações e Feedback
```
[ ] Badge numérico no ícone do Kanban na nav quando lead muda de stage
[ ] Notificação sonora/visual (pulsing dot) quando nova mensagem chega
[ ] Toast contextual: "João assumiu o lead Fulano" (broadcast Supabase Realtime)
```

### API Route faltante
```
[ ] POST /api/leads — para o N8N criar leads novos
[ ] GET /api/leads?search= — para busca no Kanban e Interações
```

### Phase 9 — Disparos em Massa (última, após produção estável)
```
[ ] Página /disparos — upload CSV + validação E.164
[ ] Template selector (buscar da Meta API)
[ ] Progress bar em tempo real (Supabase Realtime + broadcast_numbers)
[ ] Proteção: somente role='adm' acessa
```

---

## Ordem de Execução Recomendada

```
SEMANA 1:
  Camada 1 completa (segurança + bugs críticos)
  → Build limpo + tsc limpo após cada wave
  → Commit e push

SEMANA 2:
  Wave C (micro-interações) + Wave D (animações)
  → Teste visual em todas as páginas
  → Commit e push

SEMANA 3:
  Wave E (empty/error states) + Realtime (Kanban + Chat)
  → Teste com 2 abas abertas simultaneamente
  → Commit e push

SEMANA 4:
  Busca/Filtro + Notificações + APIs faltantes
  → UAT com corretores reais
  → Deploy v2.0

SEMANA 5+:
  Phase 9 — Disparos em massa
  → Apenas após validação em produção
```

---

## Consenso dos Agentes

| Agente | Voto | Prioridade #1 |
|--------|------|---------------|
| 🏗️ alliance-architect | ✅ Aprovado | **SEC-01: middleware.ts** |
| 🎨 alliance-design | ✅ Aprovado | **motion.div no lead-card** |
| ⚛️ alliance-frontend | ✅ Aprovado | **BUG-01: onAssume funcional** |
| ✅ alliance-qa | ✅ Aprovado | **SEC-01 + BUG-01 simultâneos** |
| 🗄️ alliance-db | ✅ Aprovado | **stage_changed_at no schema** |
| 🐛 alliance-debug | ✅ Aprovado | **BUG-02: setter de mensagens** |

**PLANO APROVADO POR UNANIMIDADE** ✅

---

> Próximo passo: execute `/gsd` para iniciar a Camada 1 ou peça para qualquer agente executar uma wave específica.
