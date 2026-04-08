# Decisões de Arquitetura — CRM Alliance

**Produzido por:** alliance-architect
**Data:** 2026-03-31
**Versão:** 2.0 — Plano de transformação completo em 8 waves
**Base de análise:** CLAUDE.md, ROADMAP.md, 001_schema.sql, todos os API routes,
  kanban-board.tsx, lead-detail-modal.tsx, interacoes/page.tsx, dashboard/page.tsx,
  whatsapp/send.ts, types.ts, package.json, vercel.json, progress.txt, MASTER-PLAN.md

---

## DIAGNOSTICO COMPLETO

### Pontos fortes

- Arquitetura App Router (Next.js 15) aplicada corretamente: Server Components por padrao,
  `'use client'` restrito a componentes com hooks e dnd-kit.
- Seguranca de auth implementada: `auth.getUser()` como primeira operacao em todos os API routes.
- HMAC SHA256 no webhook WhatsApp implementado corretamente com `crypto.timingSafeEqual`.
- `SUPABASE_SERVICE_ROLE_KEY` confinado a `src/lib/supabase/service.ts` e usado apenas
  em API routes server-side — nenhum vazamento detectado.
- RLS ativo nas 7 tabelas com politicas granulares ADM vs. corretor.
- Design system coeso: tokens Tailwind Alliance definidos, Framer Motion com
  animacoes padronizadas em `lib/animations.ts`.
- Kanban com optimistic updates + rollback em erro — padrao correto para UX responsivo.
- `interactions` imutavel pelo cliente — historico de mensagens confiavel.
- Schema cobre todos os casos de uso das 9 fases originais.

### Fragil idades criticas (bloqueiam producao)

1. **Webhook N8N sem autenticacao quando `N8N_WEBHOOK_SECRET` esta ausente.**
   A condicao `if (secret && incomingSecret !== secret)` significa que sem a env var
   qualquer requisicao POST eh aceita e processa updates no banco com service_role.
   Isso eh uma porta aberta para injecao de stage/summary em qualquer lead.

2. **Race condition em pause/toggle (`/api/leads/[id]/pause`).**
   O handler faz SELECT para ler `automation_paused`, nega o valor e faz UPDATE.
   Dois usuarios clicando ao mesmo tempo podem ambos ler `false`, ambos escrever `true`,
   ou pior: um ler `true` e escrever `false` revertendo acao do outro. Sem atomicidade.

3. **Interacoes/page.tsx carrega 500 mensagens em memoria no servidor.**
   Query traz `.limit(500)` de interacoes para os primeiros 50 leads e serializa tudo
   como prop inicial. Com historico real, isso vai exceder o limite de payload de
   Vercel Functions (50MB) e introduzir latencia de cold start significativa.

4. **Graph API v18.0 deprecada em `whatsapp/send.ts` e `send-message/route.ts`.**
   Dois arquivos distintos hardcodam `graph.facebook.com/v18.0`. Templates HSM da
   Phase 9 requerem endpoints da v21.0+ para campos de componentes atualizados.

5. **Sem Realtime no Kanban em producao.**
   `KanbanBoard` carrega `initialLeads` como estado local e faz optimistic updates,
   mas nao assina canal Supabase Realtime. Multiplos usuarios no mesmo Kanban
   nao verao movimentacoes uns dos outros sem reload manual.

6. **Sem modal funcional de "+ Novo Lead".**
   `KanbanPageHeader` existe mas nao implementa o dialog de criacao de lead manual.
   O botao esta visualmente presente sem acao, criando confusao operacional.

### Oportunidades tecnicas

- Realtime ja instalado e funcionando nas Interacoes — extender ao Kanban e Dashboard
  sem nova dependencia.
- `papaparse` ja instalado — modulo de Broadcasts da Phase 9 esta medio passo da
  implementacao.
- `@anthropic-ai/sdk` instalado mas nao usado diretamente no frontend — abre
  possibilidade de features de IA inline (ex: sugestao de resposta no chat).
- Design system maduro — adicionar dark mode seria questao de tokens, nao rewrite.
- Schema `sender_id` ausente em `interactions` — quando adicionado, permite
  analytics de produtividade por consultor (mensagens enviadas por humano vs. IA).

---

## DECISOES BLOQUEADAS (nao negociaveis)

Estas decisoes ja foram tomadas no MASTER-PLAN.md e sao reafirmadas aqui.
Nenhum agente pode revertelas sem aprovacao explicita do produto.

- **App Router Next.js — sem Pages Router.**
  Toda roteacao permanece em `src/app/`. Layouts aninhados sao o mecanismo
  de compartilhamento de UI e autenticacao.

- **`SUPABASE_SERVICE_ROLE_KEY` exclusivamente em `src/app/api/**` e `src/lib/supabase/service.ts`.**
  Nenhum import desta variavel em Client Components. Nenhum `NEXT_PUBLIC_` prefix.
  Violation = bloqueio de deploy.

- **HMAC SHA256 validado ANTES de qualquer leitura de payload no webhook Meta.**
  `request.text()` precede `JSON.parse`. `crypto.timingSafeEqual` obrigatorio.
  Sem esta validacao o webhook nao vai para producao.

- **`auth.getUser()` como primeira operacao em toda API route autenticada.**
  Retornar 401 imediatamente. Sem excecoes.

- **Meta Cloud API oficial (`graph.facebook.com`) — sem Evolution API.**
  Versao alvo: v21.0. Nenhuma wrapper nao-oficial permitida.

- **Supabase Realtime para atualizacoes ao vivo — sem polling.**
  Kanban, Interacoes e futuro Dashboard de Broadcasts usam `supabase.channel()`.

- **TypeScript estrito — sem `any` novo.**
  `as never` e `as any` existentes sao debito tecnico documentado a ser eliminado
  na Wave 1. Nenhum codigo novo pode introduzir estas escapatilhas.

- **shadcn/ui — nunca editar `src/components/ui/` manualmente.**
  Customizacoes exclusivamente via tokens Tailwind e `className` nas camadas superiores.

- **Framer Motion obrigatorio em toda transicao de pagina e abertura de modal.**
  `pageTransition` e `modalAnimation` de `lib/animations.ts` sao o padrao.
  `prefers-reduced-motion` deve ser respeitado (divida tecnica atual).

- **RLS ativo em todas as tabelas — sem excecoes.**
  Novas tabelas adicionadas na Wave 6 (ex: `notifications`) recebem RLS no mesmo
  arquivo de migration, nunca em passo separado.

- **`interactions` imutavel pelo cliente autenticado.**
  Sem UPDATE, sem DELETE. Service_role pode corrigir via migracao controlada.

- **Webhook N8N SEMPRE valida `N8N_WEBHOOK_SECRET` — sem fallback permissivo.**
  Se a env var nao estiver configurada, retornar 503 com mensagem de configuracao,
  nao aceitar a requisicao. Esta decisao reverte o comportamento atual.

- **Operacoes de toggle/pause usam RPC atomica no Postgres.**
  Nenhum SELECT + UPDATE separado para operacoes booleanas. Usar funcao
  `toggle_automation_paused(lead_id uuid)` via `supabase.rpc()`.

---

## RISCOS IDENTIFICADOS

### Risco 1 — Webhook N8N aceita requisicoes nao autenticadas (CRITICO)
**Arquivo:** `src/app/api/webhooks/n8n/route.ts`, linha 17
**Detalhe:** `if (secret && incomingSecret !== secret)` — quando `N8N_WEBHOOK_SECRET`
nao esta definida como env var, `secret` eh `undefined`, a condicao curto-circuita e
qualquer POST eh aceito. Em producao sem essa variavel configurada no Vercel, o
endpoint aceita qualquer corpo JSON e usa service_role para atualizar o banco.
**Mitigacao Wave 1:** Inverter a logica: se `secret` nao esta definida, retornar 503
"Webhook not configured". Adicionar N8N_WEBHOOK_SECRET como variavel obrigatoria
verificada no startup. Documentar no env.example como REQUIRED.

### Risco 2 — Race condition em pause/toggle (ALTO)
**Arquivo:** `src/app/api/leads/[id]/pause/route.ts`, linhas 18-27
**Detalhe:** SELECT + negacao + UPDATE nao atomicos. Janela de race de ~5ms em
banco remoto (Supabase na AWS us-east-1). Com 5 usuarios no sistema a probabilidade
eh baixa mas o efeito eh silencioso: a IA continua respondendo quando deveria estar
pausada, ou vice-versa.
**Mitigacao Wave 1:** Criar funcao PostgreSQL `toggle_automation_paused(p_lead_id uuid)`
usando `UPDATE leads SET automation_paused = NOT automation_paused WHERE id = p_lead_id
RETURNING automation_paused`. Chamar via `supabase.rpc('toggle_automation_paused', {p_lead_id: id})`.

### Risco 3 — Interacoes carrega volume excessivo de dados no servidor (ALTO)
**Arquivo:** `src/app/(protected)/interacoes/page.tsx`, linhas 22-27
**Detalhe:** `.limit(500)` de interacoes serializado como prop. Com historico real
de 90 dias em producao, 50 leads x media de 30 mensagens = 1500 objetos. A Vercel
Function tem timeout de 10s no plano Hobby; queries sem indice em `interactions(lead_id)`
podem exceder isso com dados reais.
**Mitigacao Wave 2:** Carregar apenas os ultimos 30 mensagens do lead ativo na hidratacao.
Implementar API route `GET /api/interactions/[leadId]?cursor=` com paginacao cursor-based.
Adicionar indice `idx_interactions_lead_created` em `interactions(lead_id, created_at DESC)`.

### Risco 4 — Graph API v18.0 deprecada (MEDIO, prazo iminente)
**Arquivos:** `src/lib/whatsapp/send.ts` linha 1, `src/app/api/leads/[id]/send-message/route.ts` linha 50
**Detalhe:** Dois pontos com versao hardcoded. A Meta depreca versoes da Graph API
com 2 anos de ciclo. v18.0 foi lancada em setembro 2023 — proximo sunset provavel
em setembro 2025 (potencialmente ja descontinuada). Templates HSM com componentes
interativos (buttons, quick replies) requerem v19.0+.
**Mitigacao Wave 1:** Centralizar `BASE_URL = 'https://graph.facebook.com/v21.0'` em
uma constante exportada de `lib/whatsapp/config.ts`. Ambos os arquivos importam
deste ponto unico. Nunca mais hardcode de versao.

### Risco 5 — Sem observabilidade em producao (MEDIO)
**Detalhe:** Nenhum Sentry, nenhum Vercel Analytics, nenhum structured logging.
Erros silenciosos em webhooks (ex: N8N envia payload malformado, Meta API retorna
429, Claude API retorna 529) nao geram alertas. O operador descobre falhas via
reclamacao de usuario.
**Mitigacao Wave 3:** Integrar Sentry no Next.js (instrucao de erro em route handlers
e Client Components). Adicionar structured logging com contexto (lead_id, wa_message_id)
nos webhooks. Configurar Vercel Speed Insights para performance.

### Risco 6 — Sem rate limiting no webhook WhatsApp (MEDIO para producao)
**Arquivo:** `src/app/api/webhooks/whatsapp/route.ts`
**Detalhe:** Cada mensagem WhatsApp cria uma Vercel Function invocation + 1-2 writes
no Supabase + 1 chamada ao N8N. Um burst de 1000 mensagens (campanha inbound, loop
de automacao no N8N) pode esgotar o plano Vercel Hobby (100k invocations/mes) em horas.
**Mitigacao Wave 4:** Implementar rate limiting por `wa_contact_id` via Vercel Edge
Config ou Redis (Upstash). Configurar no N8N um debounce de 2s por numero. Mover
para plano Vercel Pro antes do lancamento.

### Risco 7 — `as never` e `as any` mascaram erros de tipo em routes criticos (BAIXO)
**Arquivos:** `pause/route.ts` linha 26, `move-stage/route.ts` linha 26, `assign/route.ts` linha 23
**Detalhe:** O type assertion `as never` foi necessario porque os tipos gerados do
`@supabase/supabase-js` v2.100+ mudaram a assinatura de `.update()`. Isso significa
que `types.ts` esta desalinhado com a versao atual da biblioteca.
**Mitigacao Wave 1:** Regenerar `types.ts` via `npx supabase gen types typescript
--project-id lmvdruvmpybutmmidrfp > src/lib/supabase/types.ts`. Isso elimina todos
os workarounds de tipo.

---

## WAVE MAP — PLANO DE TRANSFORMACAO COMPLETO

### WAVE 1 — Seguranca e Debito Critico
**Objetivo:** Fechar todas as vulnerabilidades de seguranca e eliminar debito tecnico
que bloqueia producao. Nada mais deve ser construido sobre uma fundacao comprometida.
**Componentes afetados:** webhooks/n8n, leads/pause, whatsapp/send.ts,
send-message/route.ts, types.ts, banco (migration 002)
**Dependencias:** Nenhuma — pode iniciar imediatamente
**Criterios de aceite:**
  - POST /api/webhooks/n8n sem `N8N_WEBHOOK_SECRET` retorna 503
  - Toggle pause eh atomico: 100 cliques simultaneos simulados resultam em estado correto
  - `BASE_URL` centralizado em `lib/whatsapp/config.ts` (v21.0) — zero occorrencias de
    `v18.0` no codebase (verificado via grep)
  - `types.ts` regenerado — zero `as never` e `as any` nos API routes
  - Migration 002 aplicada: funcao `toggle_automation_paused` existe no banco
  - `npm run build` e `tsc --noEmit` — zero erros

**Plans:**

  Wave 1-A (paralelo):
    Plan W1-01: Corrigir webhook N8N — logica de autenticacao obrigatoria
      Inverter condicao: se `!secret` retornar 503. Adicionar validacao Zod
      no body (lead_id uuid, stage enum opcional, summary string opcional).
      Extrair VALID_STAGES para `src/lib/constants/stages.ts` (compartilhado
      com move-stage/route.ts).

    Plan W1-02: Centralizar Graph API version
      Criar `src/lib/whatsapp/config.ts` com `GRAPH_API_VERSION = 'v21.0'`
      e `GRAPH_BASE_URL`. Atualizar `send.ts` e `send-message/route.ts` para
      importar desta constante.

  Wave 1-B (depende de 1-A, paralelo):
    Plan W1-03: Migration 002 — atomicidade e indices faltantes
      Criar `002_performance_and_atomicity.sql`:
      - Funcao `toggle_automation_paused(p_lead_id uuid) RETURNS boolean`
      - Indice `idx_interactions_lead_created ON interactions(lead_id, created_at DESC)`
      - Indice `idx_leads_updated ON leads(updated_at DESC)`
      - Indice `idx_bcast_num_phone ON broadcast_numbers(phone)`
      - Campo `sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` em interactions
      - Campo `title text` em meetings
      - Trigger `on_auth_user_created` para auto-insert em user_profiles
      Aplicar via Supabase CLI ou Management API.

    Plan W1-04: Regenerar types.ts e eliminar `as never` / `as any`
      Executar `npx supabase gen types typescript --project-id lmvdruvmpybutmmidrfp`.
      Atualizar `Database` interface para incluir sender_id em interactions e title em meetings.
      Refatorar todos os API routes para eliminar type assertions desnecessarias.
      Atualizar `/api/leads/[id]/pause/route.ts` para usar `supabase.rpc('toggle_automation_paused')`.

---

### WAVE 2 — Arquitetura de Dados e Performance
**Objetivo:** Corrigir os problemas de carregamento de dados que vao travar a aplicacao
com volume real. Implementar paginacao nas Interacoes e Realtime no Kanban.
**Componentes afetados:** interacoes/page.tsx, KanbanBoard, nova API route de interactions
**Dependencias:** Wave 1 (types.ts atualizado com sender_id)
**Criterios de aceite:**
  - Interacoes carrega em menos de 2s com 200 leads e 5000 mensagens no banco
  - Kanban Realtime: mover card em aba A reflete em aba B em menos de 500ms
  - `/api/interactions/[leadId]` retorna 30 mensagens com cursor para pagina anterior
  - Cold start da Vercel Function de interacoes abaixo de 3s

**Plans:**

  Wave 2-A (paralelo):
    Plan W2-01: Paginacao cursor-based nas Interacoes
      Criar `GET /api/interactions/[leadId]/route.ts` com query params `?limit=30&before=<timestamp>`.
      Refatorar `interacoes/page.tsx` para carregar apenas os 30 ultimos do lead ativo.
      Componente cliente carrega paginas anteriores via scroll-to-top infinito.
      Remover `.limit(500)` da hidratacao inicial.

    Plan W2-02: Realtime no Kanban
      Adicionar `useEffect` em `KanbanBoard` que assina `supabase.channel('leads')`
      com filtro `postgres_changes: { event: '*', schema: 'public', table: 'leads' }`.
      Ao receber UPDATE, merge no estado local sem sobrescrever o card que o usuario
      atual esta arrastando (verificar `activeId !== payload.new.id`).
      Ao receber INSERT, adicionar card na coluna correta.
      Cleanup: `removeChannel` no return do useEffect.

  Wave 2-B (depende de 2-A):
    Plan W2-03: Realtime nas Interacoes
      Refatorar `interacoes-client.tsx` para assinar `supabase.channel('interactions')`
      filtrado por `lead_id = eq.${activeLead.id}`.
      Novas mensagens adicionadas ao final da lista sem reload.
      Trocar de lead cancela o canal anterior e assina o novo.
      Adicionar badge de mensagens nao lidas na sidebar (campo `read_at` ou contador
      calculado comparando `last_seen_at` do usuario com `created_at` das interactions).

---

### WAVE 3 — Observabilidade e Resiliencia
**Objetivo:** O sistema deve falhar de forma visivel e recuperavel. Sem isso, o operador
nao sabe quando o fluxo WhatsApp-N8N-IA esta quebrado.
**Componentes afetados:** Todos os API routes, next.config.ts, novo middleware de logging
**Dependencias:** Wave 1 (fundacao segura)
**Criterios de aceite:**
  - Erro em qualquer API route aparece no Sentry com contexto (lead_id, user_id)
  - Falha na Meta API (429, 5xx) cria entrada em tabela `error_logs` no Supabase
  - Dashboard mostra indicador "sistema degradado" se webhook WhatsApp nao recebeu
    nenhuma mensagem nas ultimas 24h (health check)
  - `npm run build` com `SENTRY_DSN` configurado — zero warnings de instrumentacao

**Plans:**

  Wave 3-A:
    Plan W3-01: Integracao Sentry
      Instalar `@sentry/nextjs`. Configurar `sentry.client.config.ts` e
      `sentry.server.config.ts`. Instrumentar os webhooks com `Sentry.withScope`
      para adicionar `lead_id` e `wa_message_id` como extras. Configurar
      `SENTRY_DSN` como env var no Vercel. Adicionar `sentry.edge.config.ts`
      se middleware de Edge for usado no futuro.

    Plan W3-02: Structured logging nos webhooks
      Criar `src/lib/logger.ts` com funcao `log(level, event, context)` que
      escreve JSON estruturado para stdout (visivel nos Vercel Function logs).
      Wrappear todos os try/catch nos webhooks com `logger.error('webhook_error', { ... })`.
      Logar cada mensagem recebida com `logger.info('message_received', { wa_message_id })`.

  Wave 3-B (depende de 3-A):
    Plan W3-03: Health check endpoint e indicador no Dashboard
      Criar `GET /api/health/route.ts` que retorna: `{ status, last_webhook_at, db_connected }`.
      Consulta `MAX(created_at)` das interactions mais recentes.
      Adicionar componente `SystemStatus` no Dashboard que mostra ponto verde/amarelo/vermelho
      baseado no resultado do health check (Server Component, dados frescos a cada render).

---

### WAVE 4 — Funcionalidades Core Faltantes
**Objetivo:** Implementar as funcionalidades que estao ausentes e que os usuarios
reportam como bloqueantes: novo lead manual, badge de nao lidas, UI de broadcasts.
**Componentes afetados:** KanbanPageHeader, interacoes sidebar, nova pagina /broadcasts
**Dependencias:** Wave 2 (Realtime e paginacao implementados)
**Criterios de aceite:**
  - ADM ou corretor consegue criar lead manualmente com nome, telefone e estagio inicial
  - Sidebar de Interacoes mostra badge numerico de mensagens nao lidas por lead
  - Pagina /broadcasts acessivel apenas para role 'adm' (verificado no layout)
  - Broadcast pode ser criado em status 'draft' com template selecionado

**Plans:**

  Wave 4-A (paralelo):
    Plan W4-01: Modal "+ Novo Lead"
      Implementar `NewLeadDialog` em `src/components/kanban/new-lead-dialog.tsx`.
      Campos: nome (obrigatorio), telefone E.164 (obrigatorio, validacao Zod),
      estagio inicial (select, padrao 'lead_frio'), consultor atribuido (opcional).
      `POST /api/leads/route.ts` criado com validacao Zod completa.
      Ao criar, lead aparece no Kanban via Realtime (sem reload manual).
      Conectar ao botao em `KanbanPageHeader`.

    Plan W4-02: Badge de mensagens nao lidas
      Adicionar campo `last_seen_at jsonb` em `user_profiles` (mapa lead_id -> timestamp)
      OU criar tabela `lead_read_state(user_id, lead_id, last_seen_at)` com RLS.
      Abordagem preferida: tabela separada (sem inflar user_profiles).
      Componente `UnreadBadge` na sidebar de Interacoes: conta interactions com
      `created_at > last_seen_at[lead_id]` e `direction = 'inbound'`.
      Ao selecionar lead, fazer UPSERT em `lead_read_state`.

  Wave 4-B (depende de 4-A):
    Plan W4-03: Pagina /broadcasts — listagem e criacao
      Criar `src/app/(protected)/broadcasts/page.tsx` com guard de role 'adm'
      no layout ou via redirect server-side.
      Listar campanhas existentes com status badge colorido.
      Botao "Nova campanha" abre dialog com campos: nome da campanha, template Meta.
      Criar `POST /api/broadcasts/route.ts` com validacao Zod.
      Adicionar item "Disparos" no NavShell (visivel apenas para role 'adm').

    Plan W4-04: CSV upload e validacao de numeros
      Componente `CsvUploader` com drag-and-drop (sem nova dependencia — input file nativo).
      `papaparse` ja instalado: parse client-side com preview de 5 primeiras linhas.
      Validacao E.164 com regex `/^\+[1-9]\d{10,14}$/`.
      Preview mostra contagem de validos/invalidos antes de confirmar.
      `POST /api/broadcasts/[id]/numbers/route.ts` insere em `broadcast_numbers`.

---

### WAVE 5 — Integracao WhatsApp Completa (Phase 9)
**Objetivo:** Implementar o modulo de disparos HSM completo com progresso ao vivo,
completando a Phase 9 do roadmap original.
**Componentes afetados:** /api/broadcasts/[id]/send, broadcasts/page.tsx,
lib/whatsapp/templates.ts
**Dependencias:** Wave 4 (UI de broadcasts), Wave 1 (Graph API v21.0)
**Pre-requisito externo:** Templates HSM com status APPROVED no Meta Business Manager
**Criterios de aceite:**
  - Templates buscados ao vivo da Meta API e renderizados com preview de variaveis
  - Disparo respeita rate limit de 80 mensagens/minuto (limite conservador Meta)
  - Progresso ao vivo via Realtime: barra `sent/total` atualiza sem polling
  - Botao cancelar para campanha em andamento
  - Falhas individuais registradas em `broadcast_numbers.error_message`
  - Apenas ADM consegue iniciar disparo (verificado em API route + UI)

**Plans:**

  Wave 5-A (paralelo):
    Plan W5-01: TemplateSelector e TemplatePreview
      Implementar `lib/whatsapp/templates.ts` com `getApprovedTemplates()` chamando
      `GET /{business_account_id}/message_templates?status=APPROVED` na Graph API v21.0.
      Componente `TemplateSelector` com busca/filtro de templates.
      `TemplatePreview` renderiza o template substituindo variaveis com dados de exemplo.

    Plan W5-02: API route de disparo com rate limiting
      `POST /api/broadcasts/[id]/send/route.ts` — guard role 'adm' obrigatorio.
      Buscar `broadcast_numbers` com `status = 'pending'` em lotes de 50.
      Para cada numero: `sendTemplateMessage`, UPDATE status para 'sent' ou 'failed'.
      Rate limiting: `await new Promise(r => setTimeout(r, 750))` entre mensagens
      (equivale a ~80/min). Atualizar `broadcasts.sent` e `broadcasts.failed` a cada lote.
      Ao finalizar, marcar `broadcasts.status = 'completed'`.

  Wave 5-B (depende de 5-A):
    Plan W5-03: Progresso ao vivo e controle de campanha
      Assinar `supabase.channel('broadcast-{id}')` filtrando `broadcasts` e
      `broadcast_numbers` pelo ID da campanha.
      Componente `BroadcastProgress`: barra de progresso com `sent/total`,
      lista dos ultimos 10 resultados (sent/failed).
      Botao cancelar: `PATCH /api/broadcasts/[id]/route.ts` seta `status = 'cancelled'`.
      O loop de disparo checa `status` antes de cada lote e para se for 'cancelled'.

---

### WAVE 6 — Escalabilidade e Dados
**Objetivo:** Preparar o sistema para crescimento alem dos 5 usuarios e 34 unidades atuais.
Implementar features que agregam valor operacional sem alterar o nucleo.
**Componentes afetados:** schema (migration 003), dashboard, agenda, imoveis
**Dependencias:** Wave 3 (observabilidade ativa antes de escalar)
**Criterios de aceite:**
  - Busca/filtro no Kanban funciona com 500 leads sem degradacao visual
  - Agenda exporta reunioes como ICS (Google Calendar / Apple Calendar)
  - Imoveis permite marcar unidade como indisponivel (sem deletar)
  - Dashboard mostra grafico de conversao por estagio (funil)

**Plans:**

  Wave 6-A (paralelo):
    Plan W6-01: Busca e filtros no Kanban
      Campo de busca em `KanbanPageHeader` filtra leads por nome/telefone.
      Filtros: por consultor atribuido, por `automation_paused`.
      Filtros aplicados client-side sobre o estado local (sem nova query para cada filtro).
      Estado dos filtros em `useSearchParams` para persistencia no URL.

    Plan W6-02: Funil de conversao no Dashboard
      Novo componente `ConversionFunnel` — grafico de barras horizontais mostrando
      contagem por stage em ordem de funil (lead_frio → cliente).
      Dados buscados via Server Component junto com os outros metrics (sem nova requisicao).
      Substituir ou complementar um dos graficos atuais.

  Wave 6-B (depende de 6-A):
    Plan W6-03: Disponibilidade de imoveis e exportacao de agenda
      `PATCH /api/imoveis/[id]/route.ts` — apenas ADM pode alternar `disponivel`.
      Atualizar pagina Imoveis para mostrar badge "Indisponivel" e desabilitar CTA.
      Exportacao ICS: `GET /api/agenda/export/route.ts` gera arquivo .ics com
      todas as reunioes do mes corrente usando biblioteca `ics` (instalar).

---

### WAVE 7 — Design System Avancado e Acessibilidade
**Objetivo:** Elevar a qualidade visual e de acessibilidade para nivel de produto sério.
Corrigir dividas tecnicas de UX identificadas na auditoria.
**Componentes afetados:** globals.css, todos os componentes com animacao, NavShell
**Dependencias:** Waves 1-4 completas (sem novas funcionalidades abertas)
**Criterios de aceite:**
  - `prefers-reduced-motion` respeitado em todas as animacoes Framer Motion
  - Todos os botoes de acao tem `aria-label` e sao navegaveis por teclado
  - Score Lighthouse Accessibility >= 90 na pagina /kanban e /interacoes
  - NavShell colapsa para sidebar minima em viewport < 1280px
  - Skeleton de loading em todas as paginas que fazem fetch (agenda, imoveis)

**Plans:**

  Wave 7-A (paralelo):
    Plan W7-01: `prefers-reduced-motion` e animacoes condicionais
      Criar hook `useReducedMotion()` em `src/lib/hooks/use-reduced-motion.ts`.
      Wrappear todas as variacoes de `motion.*` em `PageTransition`, `LeadCard`,
      `LeadDetailModal` e `InteracoesClient` com check deste hook.
      Alternativa sem movimento: transicao apenas de opacity (sem y, sem scale).

    Plan W7-02: Auditoria de acessibilidade e correcoes
      Adicionar `aria-label` em todos os `<button>` que usam apenas icones.
      Garantir `role="region"` e `aria-label` nas colunas do Kanban.
      Verificar contraste de cor em stage badges (WCAG AA minimo).
      Adicionar `<title>` semantico em graficos Chart.js via `aria-label` no canvas.

  Wave 7-B (depende de 7-A):
    Plan W7-03: Skeleton loading nas paginas ausentes
      Criar `src/app/(protected)/agenda/loading.tsx` e
      `src/app/(protected)/imoveis/loading.tsx` com skeletons fieis ao layout.
      Padronizar o skeleton do Kanban para incluir as 6 colunas (nao apenas spinners).

---

### WAVE 8 — Deploy de Producao e Smoke Tests
**Objetivo:** Sistema auditado, testado e em producao. Env vars configuradas.
Webhook Meta apontando para URL de producao. Equipe treinada.
**Componentes afetados:** Vercel (env vars), Supabase (producao), N8N (Railway),
Meta Business Manager (webhook URL)
**Dependencias:** Todas as waves anteriores aprovadas por alliance-qa
**Pre-requisitos externos:**
  - Todos os env vars listados em `env.example` configurados no Vercel
  - Templates HSM aprovados pela Meta (pode levar 24-72h)
  - N8N deployado no Railway com uptime monitor ativo
**Criterios de aceite:**
  - `npm run build`, `tsc --noEmit`, `eslint` — zero erros em CI
  - Meta webhook URL de producao retorna 200 no GET de verificacao
  - POST de mensagem de teste aparece no Kanban como `lead_frio` em menos de 5s
  - Todos os 5 usuarios conseguem logar e executar fluxo completo (UAT)
  - Sentry recebe eventos de teste (erro proposital via botao de debug ADM)
  - Zero `console.log` com dados sensiveis (grep por WHATSAPP, SUPABASE, SECRET)

**Plans:**

  Wave 8-A (paralelo):
    Plan W8-01: Auditoria final de seguranca
      Grep por: `console.log`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`
      em arquivos com `'use client'` ou em pastas publicas.
      Verificar `.gitignore` cobre `.env.local`, `.env*.local`.
      Checar headers de seguranca: adicionar `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY` e `Referrer-Policy: strict-origin` em `next.config.ts`
      via `headers()` config.

    Plan W8-02: Configuracao de env vars no Vercel
      Documentar cada variavel de `env.example` com: nome, descricao, onde obter,
      se eh REQUIRED ou OPTIONAL.
      Verificar que nenhuma variavel `NEXT_PUBLIC_` contem segredos.
      Configurar `NODE_ENV=production` e testar comportamento de erro (sem stack traces
      expostos ao cliente).

  Wave 8-B (depende de 8-A):
    Plan W8-03: UAT com os 5 usuarios + smoke test
      Roteiro de teste para cada usuario: login, ver leads, mover card, abrir modal,
      pausar IA, ver interacoes, enviar mensagem manual.
      Roteiro ADM adicional: criar campanha, fazer upload CSV, ver progresso.
      Registrar bugs em `Erros/` no Obsidian.
      Deploy final com custom domain se aplicavel.

---

## SCHEMA — AJUSTES NECESSARIOS

Estes ajustes complementam os identificados no MASTER-PLAN.md (v1.0).
Os marcados como "MIGRATION 002" devem ser aplicados na Wave 1.
Os marcados como "MIGRATION 003" na Wave 6.

### Migration 002 (Wave 1 — critico):

- **`interactions.sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`**
  Motivo: distinguir IA vs. corretor no chat. Sem este campo, mensagens manuais
  do corretor e respostas da IA sao indistinguiveis por `direction = 'outbound'` sozinho.
  Permitir NULL (mensagens da IA nao tem sender humano).

- **`meetings.title text`**
  Motivo: pills do calendario precisam de texto curto. Sem `title`, o pill mostra
  apenas o nome do lead, sem contexto do tipo de reuniao.
  DEFAULT: `'Reuniao'` para retrocompatibilidade.

- **Funcao `toggle_automation_paused(p_lead_id uuid) RETURNS boolean`**
  SQL: `UPDATE leads SET automation_paused = NOT automation_paused, updated_at = now()
  WHERE id = p_lead_id RETURNING automation_paused`
  Motivo: atomicidade. Elimina race condition do SELECT+UPDATE atual.

- **Indice `idx_interactions_lead_created ON interactions(lead_id, created_at DESC)`**
  Motivo: query de historico de chat eh O(n) sem este indice. Com 5000+ mensagens,
  a tela de Interacoes vai degradar visivelmente.

- **Indice `idx_leads_updated ON leads(updated_at DESC)`**
  Motivo: sidebar de Interacoes ordena por `updated_at`. Sem indice, full scan em leads.

- **Indice `idx_bcast_num_phone ON broadcast_numbers(phone)`**
  Motivo: verificacao de duplicatas no upload de CSV faz query por phone. Sem indice,
  O(n) com CSVs grandes (5000+ numeros).

- **Trigger `on_auth_user_created` em `auth.users`**
  Motivo: sem este trigger, qualquer novo usuario criado no Supabase Dashboard
  entra no sistema sem perfil e quebra badges, saudacao e RLS de edicao de leads.
  SQL: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION handle_new_user()` onde `handle_new_user` faz INSERT em
  `public.user_profiles(id, full_name, role, badge_color)` com defaults.

### Migration 003 (Wave 6 — nao critico):

- **Tabela `lead_read_state(user_id uuid, lead_id uuid, last_seen_at timestamptz)`**
  Motivo: badge de nao lidas precisa de persistencia por usuario por lead.
  PRIMARY KEY (user_id, lead_id). RLS: usuario so ve e edita seus proprios registros.
  Index em `(user_id, lead_id)` automatico via PK.

- **`imoveis.created_at timestamptz DEFAULT now()`**
  Motivo: permite ordenacao e filtragem por data de cadastro em versoes futuras.
  Sem breaking change (DEFAULT cobre registros existentes no re-insert com ON CONFLICT).

---

## PONTOS FORTES DO PROJETO — PRESERVAR

Estes padroes estao corretos e nao devem ser alterados nas waves:

- Optimistic updates com rollback em `kanban-board.tsx` — padrao correto.
- `selectedLead` derivado do array autoritativo (nao estado separado) — evita stale state.
- `Promise.all` para queries paralelas no Dashboard — evita waterfall.
- Server Component para fetch inicial em todas as paginas — SSR correto.
- `auth.getUser()` na primeira linha de todos os API routes — compliance de seguranca.
- `crypto.timingSafeEqual` na validacao HMAC — previne timing attacks.
- `DragOverlay` com `dropAnimation` configurado — UX de drag correto.
- Inter via `next/font/google` — sem layout shift de fonte.

---

## APROVADO PARA INICIAR CONSTRUCAO: SIM

**Prioridade de execucao:**
Wave 1 e Wave 2 sao PRE-REQUISITOS para qualquer outra wave.
Nao construir cima de seguranca comprometida (Wave 1) nem de arquitetura de dados
que vai quebrar com volume real (Wave 2).

**Waves que podem rodar em paralelo apos Wave 1+2:**
- Wave 3 (observabilidade) e Wave 4 (funcionalidades) sao independentes entre si.
- Wave 5 (disparos) depende de Wave 4.
- Wave 6 (escalabilidade) depende de Wave 3.
- Wave 7 (design/acessibilidade) pode rodar em paralelo com qualquer wave apos Wave 2.
- Wave 8 (deploy) somente apos todas as outras waves aprovadas pelo alliance-qa.

**Bloqueio externo para Wave 5:**
Templates HSM devem ter status APPROVED no Meta Business Manager.
Este processo pode levar 24-72h e deve ser iniciado em paralelo com a Wave 4.

**Aviso sobre plano Vercel:**
O plano Hobby suporta 100k Function invocations/mes. Com uso real de WhatsApp
em producao (estimativa: 50 leads x 10 mensagens/dia = 500 invocations/dia = 15k/mes),
o plano Hobby eh suficiente para o volume atual da La Reserva (5 consultores, 34 unidades).
Mover para Pro somente se ultrapassar 50k invocations/mes ou se precisar de
custom domains com SSL automatico em subdominios.
