# Decisões de Arquitetura — CRM Alliance

**Produzido por:** alliance-architect
**Data:** 2026-03-26
**Base:** CLAUDE.md + ROADMAP.md + 001_schema.sql

---

## Decisões bloqueadas (não negociáveis)

- **App Router do Next.js 14 — sem Pages Router** — toda a roteação usa `app/` com layouts aninhados; qualquer componente que precise de estado ou eventos usa `'use client'` explícito; Server Components são o padrão
- **`SUPABASE_SERVICE_ROLE_KEY` exclusivamente em API routes server-side** — nunca em Client Components, nunca com prefixo `NEXT_PUBLIC_`, nunca em logs; violação bloqueia o build via checklist de segurança obrigatório
- **HMAC SHA256 antes de qualquer processamento no webhook Meta** — o header `X-Hub-Signature-256` deve ser validado como primeira instrução do POST handler; rejeitar com 403 se inválido, sem exceções
- **`auth.getUser()` como primeira operação em toda API route** — retornar 401 imediatamente se não autenticado; nenhuma query ao banco ocorre antes dessa verificação
- **Meta Cloud API oficial (graph.facebook.com) — sem Evolution API ou qualquer wrapper não oficial** — a integração WhatsApp segue exclusivamente a API oficial da Meta
- **Supabase Realtime para atualizações ao vivo** — Kanban e Interações usam `supabase.channel()` com subscription na tabela `interactions` e `leads`; nenhum polling
- **TypeScript estrito sem `any`** — `tsconfig.json` com `"strict": true`; nenhum `as unknown`, nenhum type assertion sem justificativa documentada; tipos do banco exportados exclusivamente de `src/lib/supabase/types.ts`
- **shadcn/ui como base de componentes UI** — os arquivos gerados em `src/components/ui/` não são editados manualmente; customizações via tokens Tailwind no `tailwind.config.ts`
- **Framer Motion obrigatório em toda transição de página e modal** — usar `pageTransition` e `modalAnimation` definidos no ROADMAP como padrão; respeitar `prefers-reduced-motion`
- **RLS ativo em todas as 7 tabelas** — nenhuma tabela aceita acesso sem policy explícita; service_role bypassa RLS apenas em contexto server-side documentado
- **`interactions` é imutável pelo cliente** — sem policies de UPDATE/DELETE para usuários autenticados; histórico de mensagens nunca pode ser editado ou deletado via CRM
- **Seed de imóveis no próprio schema SQL** — os 6 imóveis do La Reserva são dados estáticos inseridos via `ON CONFLICT (id) DO NOTHING`; não há interface de CRUD para imóveis no v1

---

## Top 3 riscos técnicos

1. **Vazamento do `SUPABASE_SERVICE_ROLE_KEY` via bundle do Next.js** — risco de exposição acidental ao prefixar a variável com `NEXT_PUBLIC_` ou importá-la em arquivo com `'use client'`
   — Mitigação: verificação automática no checklist pré-commit (`grep -r SUPABASE_SERVICE_ROLE_KEY src/ --include="*.ts" --include="*.tsx"`); o agente `alliance-qa` executa esta checagem em toda fase; a variável só aparece em `src/app/api/**` e `src/lib/supabase/server.ts`

2. **Falha de validação HMAC no webhook WhatsApp em produção** — diferença de encoding, body parser que consome o stream antes da verificação ou secret incorreto resultam em todos os webhooks sendo rejeitados com 403, derrubando toda a automação IA
   — Mitigação: usar `request.text()` para ler o body raw antes de qualquer parsing; calcular HMAC com `crypto.subtle` usando a raw string; testar a rota com o token correto como primeiro critério da Phase 7; nunca usar `request.json()` antes da verificação de assinatura

3. **Race condition no Kanban com múltiplos usuários e Realtime** — dois corretores movendo o mesmo card simultaneamente ou N8N atualizando o stage enquanto um corretor faz drag podem causar estado inconsistente entre tabs
   — Mitigação: operação de UPDATE no stage usa `updated_at` como campo de controle de concorrência otimista; o frontend recarrega o card do Supabase após confirmar o drag (não usa só o estado local); Realtime subscription sobrescreve o estado local com o dado do banco ao receber evento

---

## Wave map por fase

### Phase 1 — Design System
```
Wave 1 (paralela):
  Plan 01-01 — Next.js 14 setup + dependências + tailwind.config.ts com tokens Alliance + shadcn/ui init
  (standalone, sem dependência interna)

Wave 2 (depende de 01-01):
  Plan 01-02 — Componentes base: BlobBottom, BlobHeader, NavShell, AllianceBadge, AllianceCard, PageTransition
               + animations.ts com pageTransition, modalAnimation, staggerContainer, staggerItem, cardHover, dragCard

Wave 3 (depende de 01-02):
  Plan 01-03 — Splash screen animada + tela de login visual (sem auth real)
               Rota: app/(auth)/login/page.tsx — fora do NavShell
```

### Phase 2 — Fundação
```
Wave 1 (depende de Phase 1):
  Plan 02-01 — src/lib/supabase/client.ts (createBrowserClient)
             + src/lib/supabase/server.ts (createServerClient com cookies)
             + src/lib/supabase/types.ts (Database type gerado do schema)
             + teste de conectividade

Wave 2 (depende de 02-01, paralelos entre si):
  Plan 02-02 — alliance-db executa 001_schema.sql via Supabase Management API
             + valida RLS via pg_tables + pg_policies
             + seed de imóveis confirmado por SELECT
  Plan 02-03 — Auth Server Action (signIn/signOut)
             + middleware.ts de proteção de rotas (redirect /login se não autenticado)
             + conectar tela de login da Phase 1 ao Supabase Auth real
```

### Phase 3 — Dashboard
```
Wave 1 (depende de Phase 2):
  Plan 03-01 — Layout da página dashboard + MetricCard (variantes featured/default)
             + MetricsGrid (2×3) + skeleton de carregamento

Wave 2 (depende de 03-01, paralelos entre si):
  Plan 03-02 — ActivityChart: 2 gráficos de barras Chart.js (cor #1E90FF)
             + animações de entrada (staggerContainer)
  Plan 03-03 — Queries Supabase reais para métricas
             + saudação dinâmica "BEM-VINDO, [nome]!" em alliance-blue
             + animação counter 0→valor com Framer Motion spring

Wave 3 (depende de 03-02 e 03-03):
  [QA alliance-qa: build + tipos + lint + verificação visual]
```

### Phase 4 — Kanban
```
Wave 1 (depende de Phase 2):
  Plan 04-01 — KanbanBoard (DndContext do dnd-kit)
             + KanbanColumn × 6 com ícones coloridos
             + buscar leads do Supabase por stage

Wave 2 (depende de 04-01):
  Plan 04-02 — LeadCard (draggable) com badge dinâmico via user_profiles.badge_color
             + Supabase Realtime subscription na tabela leads
             + UPDATE de stage no drag-end

Wave 3 (depende de 04-02, paralelos entre si):
  Plan 04-03 — Modal de detalhes do lead (AnimatePresence + modalAnimation)
             + campos: nome, phone, city, imovel_interesse, intention, tempo, summary
  Plan 04-04 — AssignButton (POST /api/leads/[id]/assign)
             + PauseButton (PATCH /api/leads/[id]/pause)
             + botões Etiquetas e Novo Lead

Wave 4 (depende de 04-03 e 04-04):
  [QA alliance-qa]
```

### Phase 5 — Agenda
```
Wave 1 (depende de Phase 4):
  Plan 05-01 — Layout calendário mensal
             + células de dias com abreviações pt-BR (seg, ter, qua, qui, sex, sáb, dom)
             + célula hoje com fundo alliance-blue
             + navegação mês/ano anterior/próximo

Wave 2 (depende de 05-01):
  Plan 05-02 — MeetingPill com cor do consultor (busca user_profiles.badge_color)
             + seletores de mês/ano
             + buscar meetings do Supabase para o mês exibido

Wave 3 (depende de 05-02):
  Plan 05-03 — CreateMeetingDialog (abre ao mover card Kanban para 'reuniao_agendada')
             + lead pré-preenchido no dialog
             + POST /api/meetings (INSERT na tabela meetings)
             + sync Kanban → Agenda via Realtime

  [QA alliance-qa]
```

### Phase 6 — Imóveis + Interações
```
Wave 1 (depende de Phase 4 — leads e interactions existem):
  Plan 06-01 — Página /imoveis: 6 ImóvelCard com dados do Supabase
             + metragem, quartos, suítes, diferenciais, faixa de valor, disponibilidade
             + animação stagger de entrada nos cards

Wave 2 (depende de Phase 4, paralelo a 06-01):
  Plan 06-02 — Layout /interacoes:
               - Sidebar esquerda (#0A2EAD): logo + lista de leads ordenados por última interação
               - Lead ativo com fundo alliance-blue (#1E90FF)
               - Área de chat (#CCCCCC): header escuro + pills inbound (azul, esquerda)
                 + cards outbound IA (branco + badge "agente de IA", direita)
               - Supabase Realtime na tabela interactions (scroll automático)

Wave 3 (depende de 06-02):
  Plan 06-03 — Input de envio manual (visível apenas quando automation_paused = true)
             + POST /api/leads/[id]/send-message → lib/whatsapp/send.ts → Meta API
             + estados de loading e erro no envio

  [QA alliance-qa]
```

---

## Schema SQL — ajustes necessários

- **`interactions` não possui campo `sender_id`** — quando um corretor envia mensagem manual (direction: 'outbound'), não há como distinguir "quem" enviou (IA vs. qual corretor); recomendado adicionar `sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` à tabela `interactions` — o frontend exibe o nome do corretor no card outbound via JOIN com `user_profiles`; sem esse campo, só é possível inferir pelo estado `automation_paused`, que é impreciso
- **`leads` não possui `updated_at` com índice** — o campo `updated_at` existe e tem trigger, mas não há `CREATE INDEX` para ele; a sidebar de Interações ordena leads por última interação (`ORDER BY interactions.created_at DESC` via JOIN), o que pode ser lento com volume; considerar `idx_leads_updated` em `leads(updated_at DESC)` para suportar o ordenamento da sidebar
- **`user_profiles` sem `INSERT` via trigger automático** — o seed de usuários está comentado no schema e depende de execução manual separada após criar os usuários no Auth Dashboard; recomendado criar trigger `AFTER INSERT ON auth.users` que insere automaticamente em `user_profiles` com valores padrão, evitando estado inconsistente onde o usuário existe no Auth mas não tem perfil
- **`meetings` sem campo `title` ou `location`** — a tabela tem apenas `notes` como campo descritivo; para a agenda mensal com pills, o pill precisa de um texto curto de exibição; recomendado adicionar `title text` (opcional) para uso nos pills do calendário sem depender do JOIN com leads.name em toda renderização do mês
- **`broadcast_numbers` sem índice em `phone`** — em campanhas com CSVs de centenas de números, a verificação de duplicatas e o status por número dependem de busca por `phone`; adicionar `CREATE INDEX idx_bcast_num_phone ON broadcast_numbers(phone)` antes da Phase 9

---

## Estrutura de pastas recomendada

```
src/
  app/
    (auth)/
      login/
        page.tsx              ← fora do NavShell; splash + login visual
    (protected)/
      layout.tsx              ← NavShell wrapper; verifica sessão via middleware
      dashboard/
        page.tsx              ← Server Component; busca métricas no servidor
        loading.tsx           ← skeleton automático do Next.js
      kanban/
        page.tsx              ← Client Component (dnd-kit exige)
        loading.tsx
      agenda/
        page.tsx              ← Server Component + Client islands para calendar
        loading.tsx
      imoveis/
        page.tsx              ← Server Component; SELECT * FROM imoveis
      interacoes/
        page.tsx              ← Client Component (Realtime + scroll)
        [lead_id]/
          page.tsx            ← chat do lead específico (URL compartilhável)
    api/
      leads/
        route.ts              ← GET (lista) + POST (novo lead manual)
        [id]/
          route.ts            ← GET (detalhes) + PATCH (stage/campos)
          assign/
            route.ts          ← POST: assigned_to = auth.uid()
          pause/
            route.ts          ← PATCH: automation_paused toggle
          send-message/
            route.ts          ← POST: sendTextMessage via Meta API
      meetings/
        route.ts              ← GET + POST
        [id]/
          route.ts            ← PATCH + DELETE
      broadcasts/
        route.ts              ← GET + POST (apenas ADM)
        [id]/
          route.ts            ← GET progresso + PATCH status
          send/
            route.ts          ← POST: inicia disparo em massa
      webhooks/
        whatsapp/
          route.ts            ← GET (verificação hub.challenge) + POST (HMAC + N8N)
        n8n/
          route.ts            ← POST: sync stage + summary vindos do N8N
  components/
    layout/
      nav-shell.tsx           ← layout principal com BlobHeader e navegação
      blob-header.tsx         ← clip-path: ellipse(60% 100% at 100% 0%), #1565C0
      blob-bottom.tsx         ← clip-path: ellipse(75% 100% at 50% 100%), #1E90FF
      page-transition.tsx     ← wrapper Framer Motion com pageTransition preset
    ui/                       ← shadcn/ui gerados (nunca editar manualmente)
    dashboard/
      metric-card.tsx         ← variantes: featured (#0A2EAD) e default (#F0F0F0)
      metrics-grid.tsx        ← grid 2×3 com stagger animation
      activity-chart.tsx      ← Chart.js barras, cor #1E90FF
    kanban/
      kanban-board.tsx        ← DndContext provider
      kanban-column.tsx       ← DroppableColumn com contador e ícone colorido
      lead-card.tsx           ← DraggableCard com badge dinâmico
      lead-modal.tsx          ← AnimatePresence + detalhes completos do lead
      alliance-badge.tsx      ← badge consultor/IA com badge_color do banco
    agenda/
      calendar-grid.tsx       ← grid mensal, células pt-BR, hoje destacado
      meeting-pill.tsx        ← pill colorido com badge_color do consultor
      create-meeting-dialog.tsx
    imoveis/
      imovel-card.tsx         ← card unidade com metragem, quartos, valor, disponibilidade
    interacoes/
      chat-sidebar.tsx        ← lista de leads ordenada por última interação (#0A2EAD)
      chat-area.tsx           ← área de mensagens com Realtime
      message-bubble.tsx      ← variante inbound (azul) e outbound (branco + badge)
      send-input.tsx          ← input manual (visível se automation_paused)
  lib/
    supabase/
      client.ts               ← createBrowserClient (para 'use client')
      server.ts               ← createServerClient com cookies (Server Components + API routes)
      types.ts                ← Database type gerado; todos os tipos do banco exportados daqui
    whatsapp/
      send.ts                 ← sendTextMessage(phone, text) + sendTemplateMessage(phone, template, params)
      templates.ts            ← getApprovedTemplates() via Meta API
    animations.ts             ← pageTransition, modalAnimation, staggerContainer, staggerItem, cardHover, dragCard
    utils/
      cn.ts                   ← classnames helper (clsx + tailwind-merge)
      format.ts               ← formatPhone(e164), formatCurrency(BRL), formatDate(pt-BR)
  middleware.ts               ← proteção de rotas: redireciona /login se não autenticado
```

---

## Notas de implementação críticas

### Webhook WhatsApp — body raw antes do HMAC
```typescript
// CORRETO: ler texto bruto antes de qualquer parsing
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const valid = await verifyHMAC(rawBody, process.env.WHATSAPP_APP_SECRET!, signature)
  if (!valid) return new Response('Forbidden', { status: 403 })
  const body = JSON.parse(rawBody)
  // ... processar
}
```

### Realtime — padrão de subscription
```typescript
// Subscribing na tabela interactions para um lead específico
supabase
  .channel(`interactions:${leadId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'interactions',
    filter: `lead_id=eq.${leadId}`
  }, (payload) => setMessages(prev => [...prev, payload.new as Interaction]))
  .subscribe()
```

### RLS — comportamento esperado por papel
| Operação | ADM | Corretor (assigned) | Corretor (não assigned) | service_role |
|----------|-----|---------------------|-------------------------|--------------|
| SELECT leads | Sim | Sim | Sim | Sim |
| UPDATE leads | Sim | Sim | Não | Sim |
| DELETE leads | Sim | Não | Não | Sim |
| INSERT interactions | Sim | Sim | Sim | Sim |
| UPDATE interactions | Não | Não | Não | Sim |
| Gerenciar broadcasts | Sim | Não | Não | Sim |

---

## Aprovado para iniciar construção: SIM

Pré-condições para iniciar Phase 1:
1. `.env.local` criado com todas as variáveis de `env.example` preenchidas
2. Projeto Supabase acessível em `https://lmvdruvmpybutmmidrfp.supabase.co`
3. `node --version` >= 18.17 (requisito Next.js 14)
4. Agentes em `.claude/agents/` verificados (Phase 0 completa)
