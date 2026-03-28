# CRM Alliance — La Reserva

<!-- GSD:project-start source:.planning/PROJECT.md -->
## Project

CRM web app para a Alliance Investimentos Imobiliários gerenciar leads do La Reserva captados via WhatsApp. Um agente de IA (prompt já finalizado) qualifica e nutre leads automaticamente via WhatsApp Business API oficial da Meta. Corretores acompanham em tempo real, assumem conversas, gerenciam reuniões e visualizam o histórico completo de cada lead.

**Core Value:** O corretor abre o sistema, vê qual lead tocar, lê o resumo da conversa e age — sem retrabalho, sem lead perdido, sem IA respondendo sem contexto.

**Usuários:** Lucas, João, Marco, Jaque (corretores) + ADM — 5 usuários totais.

**Produto:** La Reserva — 34 unidades exclusivas de alto padrão em Castelo, ES.

**Páginas do sistema:**
1. `/login` — autenticação
2. `/dashboard` — métricas do dia + gráficos
3. `/kanban` — pipeline de leads com 6 colunas drag-and-drop
4. `/agenda` — calendário mensal de reuniões com pills coloridos por consultor
5. `/imoveis` — catálogo das 6 unidades do La Reserva
6. `/interacoes` — interface estilo WhatsApp com histórico de conversas por lead
<!-- GSD:project-end -->

<!-- GSD:stack-start source:.planning/STACK.md -->
## Technology Stack

```
Frontend:     Next.js 14 (App Router) + TypeScript + Tailwind CSS
UI:           shadcn/ui + dnd-kit (Kanban) + Chart.js (Dashboard)
Fonte:        Inter (next/font/google)
Animações:    Framer Motion — transições fluídas entre páginas e componentes
Banco:        Supabase (PostgreSQL + Auth + RLS + Realtime)
WhatsApp:     Meta Cloud API oficial (graph.facebook.com) — SEM Evolution API
Orquestração: N8N (Railway)
IA:           Claude API (Anthropic) com contexto completo do lead
Deploy:       Vercel (frontend) + Railway (N8N)
```

**Dependências principais:**
```bash
# UI e animações
framer-motion           # animações fluídas
@dnd-kit/core           # drag-and-drop do Kanban
@dnd-kit/sortable
@dnd-kit/utilities
chart.js                # gráficos do dashboard
react-chartjs-2

# Banco
@supabase/supabase-js
@supabase/ssr

# Formulários e validação
react-hook-form
@hookform/resolvers
zod

# Utilitários
date-fns                # datas em pt-BR
papaparse               # parse de CSV (disparos)
@types/papaparse

# IA
@anthropic-ai/sdk
```
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:.planning/CONVENTIONS.md -->
## Conventions

### Estrutura de arquivos
```
src/
├── app/
│   ├── (auth)/login/          ← tela de login (fora do layout principal)
│   ├── dashboard/
│   ├── kanban/
│   ├── agenda/
│   ├── imoveis/
│   ├── interacoes/
│   └── api/
│       ├── webhooks/
│       │   ├── whatsapp/      ← GET verificação + POST mensagens Meta
│       │   └── n8n/           ← updates de stage e summary vindos do N8N
│       ├── leads/
│       ├── meetings/
│       └── broadcasts/
├── components/
│   ├── ui/                    ← shadcn/ui gerados (não editar manualmente)
│   ├── layout/                ← NavShell, BlobHeader, BlobBottom
│   ├── dashboard/
│   ├── kanban/
│   ├── agenda/
│   ├── imoveis/
│   └── interacoes/
└── lib/
    ├── supabase/
    │   ├── client.ts          ← createBrowserClient (para 'use client')
    │   └── server.ts          ← createServerClient (para Server Components e API routes)
    ├── whatsapp/
    │   ├── send.ts            ← sendTextMessage + sendTemplateMessage via Meta API
    │   └── templates.ts       ← getApprovedTemplates da Meta API
    └── utils/
        ├── cn.ts              ← classnames helper
        └── format.ts          ← formatPhone, formatCurrency, formatDate pt-BR
```

### TypeScript
- **TypeScript estrito** — sem `any`, sem `as unknown`, sem type assertions desnecessárias
- Preferir `interface` para objetos, `type` para unions e aliases
- Exportar tipos do banco de `src/lib/supabase/types.ts`
- Nunca importar tipos do `@supabase/supabase-js` diretamente nas páginas — usar os tipos locais

### Componentes React
- **Server Components por padrão** — `'use client'` SOMENTE quando necessário:
  - Hooks (`useState`, `useEffect`, `useRouter`)
  - Event handlers diretos no JSX
  - Framer Motion (requer client)
  - dnd-kit (requer client)
- Composição de componentes — nunca herança
- Props tipadas com `interface`, nunca `any`
- Loading states em toda operação assíncrona (skeleton ou spinner)

### Nomenclatura
- Arquivos de componente: `kebab-case.tsx` (ex: `lead-card.tsx`)
- Exports dos componentes: `PascalCase` (ex: `export function LeadCard()`)
- Arquivos de utilitário: `kebab-case.ts`
- Variáveis e funções: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`

### API Routes
- Verificar `auth.getUser()` **antes de qualquer operação** — retornar 401 se não autenticado
- Validar body com Zod antes de processar
- Retornar sempre `{ data, error }` — nunca throw sem catch
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` em client components

### Animações (Framer Motion)
- Usar `AnimatePresence` para entradas/saídas de modais e cards
- Transições de página: `opacity` + `y` leve (8-16px), duração 0.2-0.3s
- Cards Kanban: drag com `scale(1.02)` e sombra durante o arraste
- Sidebar Interações: slide-in lateral suave (0.25s ease-out)
- Respeitar `prefers-reduced-motion`:
  ```typescript
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ```
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:.planning/ARCHITECTURE.md -->
## Architecture

### Fluxo WhatsApp → CRM → IA → Resposta
```
Usuário envia msg no WhatsApp
  → Meta Cloud API → POST /api/webhooks/whatsapp
  → Validar X-Hub-Signature-256 (HMAC SHA256 com WHATSAPP_APP_SECRET)
  → Extrair: phone, message, wa_message_id
  → POST para N8N_WEBHOOK_URL com payload + N8N_WEBHOOK_SECRET

N8N:
  ├── Buscar lead pelo phone no Supabase
  │     ├── Não existe → INSERT (stage: lead_frio)
  │     └── Existe → UPDATE interaction_count + 1
  ├── INSERT interaction (inbound, wa_message_id)
  ├── Checar automation_paused → true: STOP
  ├── Checar stage = 'cliente' → STOP
  ├── Buscar histórico (últimas 10 interactions)
  ├── Montar CONTEXTO COMPLETO do lead para o Claude:
  │     nome, stage, intention, imovel_interesse, city,
  │     interaction_count, assigned_to_name, summary, histórico
  ├── POST Claude API (claude-sonnet-4-20250514) com contexto + prompt La Reserva
  ├── INSERT interaction (outbound, resposta IA)
  ├── UPDATE leads.summary com resumo atualizado
  ├── Atualizar stage se necessário (≥5 → lead_morno, ≥10 → lead_quente)
  └── POST graph.facebook.com/.../messages (type: text, resposta IA)

Após resposta:
  → POST /api/webhooks/n8n (com N8N_WEBHOOK_SECRET no header)
  → Atualiza stage + summary no CRM
  → Supabase Realtime notifica Kanban e Interações em tempo real
```

### Contexto enviado ao agente de IA (NUNCA deixar incompleto)
```
CONTEXTO DO LEAD:
- Nome: {name}
- Estágio: {stage}
- Intenção: {intention} (morar | investir | null)
- Imóvel de interesse: {imovel_interesse}
- Número de interações: {interaction_count}
- Consultor atribuído: {assigned_to_name} (ou "agente de IA")
- Cidade: {city}
- Resumo da conversa: {summary}

HISTÓRICO (últimas 10 mensagens):
[alternância inbound/outbound]

MENSAGEM ATUAL: {message}

[PROMPT LA RESERVA COMPLETO AQUI]
```

### RLS — Estratégia de acesso
```
ADM:      lê e escreve em tudo
Corretor: lê tudo (Kanban compartilhado), edita apenas leads assigned_to = seu id
Webhook:  usa SUPABASE_SERVICE_ROLE_KEY server-side (bypassa RLS — apenas em API routes)
```

### Página Interações — Estilo WhatsApp
```
Layout:
├── Sidebar esquerda (fundo #0A2EAD)
│   ├── Logo Alliance (branco)
│   └── Lista de leads (ordenados por última interação)
│       └── Lead ativo: fundo alliance-blue (#1E90FF)
└── Área de chat (fundo #CCCCCC)
    ├── Header: nome + telefone + ícones (pausa, IA/consultor)
    ├── Mensagens inbound: pills azuis (#1E90FF), alinhadas à esquerda
    ├── Mensagens outbound IA: cards brancos + badge "agente de IA", à direita
    ├── Mensagens outbound corretor: cards brancos + nome do corretor, à direita
    └── Input de envio manual (somente se automation_paused = true)

Comportamento:
- Realtime: novas mensagens aparecem sem reload (Supabase Realtime na tabela interactions)
- Scroll automático para última mensagem
- Mensagem manual do corretor: INSERT na tabela interactions (direction: 'outbound')
  + envio via /api/leads/{id}/send-message → Meta API (sendTextMessage)
  Nota: envio manual só possível com automation_paused = true
        ou com o lead no stage 'cliente'
```

### Design System — Fonte da Verdade Visual
```
Cores principais:
  alliance.blue:  #1E90FF  ← azul vivo, títulos de página, pills de mensagem
  alliance.dark:  #0A2EAD  ← azul escuro, sidebar Interações, cards destacados Dashboard
  alliance.mid:   #1565C0  ← blob do header/nav

Cores de status (colunas Kanban):
  Lead Frio:       #1E90FF (azul)
  Lead Morno:      #FF8C00 (laranja)
  Lead Quente:     #FF4500 (vermelho-laranja)
  Reunião Agendada:#228B22 (verde)

Badges de consultores (dinâmico via user_profiles.badge_color):
  João:   #FF6B00
  Outros: #0A2EAD (padrão)
  ADM:    #0A2EAD

Blobs/semicírculos: clip-path CSS (não border-radius simples)
  Rodapé splash/login: clip-path: ellipse(75% 100% at 50% 100%)
  Header/nav:          clip-path: ellipse(60% 100% at 100% 0%)

Animações (Framer Motion):
  Transição de página:  opacity 0→1 + y 16→0, 0.25s ease-out
  Modal/Sheet:          scale 0.96→1 + opacity 0→1, 0.2s
  Card Kanban (drag):   scale 1→1.02, sombra aumenta
  Sidebar Interações:   x -20→0 + opacity 0→1, 0.25s ease-out
  Badge de status:      color transition 0.3s ao mudar stage
```
<!-- GSD:architecture-end -->

<!-- GSD:profile-start -->
## Developer Profile

**Contexto:** Vibe coder — usa IA para construir, sem background técnico formal.
Prefere explicações em português. Quer código funcional, bem animado e fiel ao design.

**Comportamento esperado do Claude Code:**
- Anunciar cada subtarefa antes de executar (o que vai fazer e por quê)
- Perguntar antes de tomar decisões arquiteturais que não estejam documentadas aqui
- Nunca pular a verificação de build + TypeScript após cada plan
- Sempre usar a skill `ui-ux` quando criar ou modificar interface
- Em caso de dúvida sobre design, consultar a seção Architecture → Design System acima

**Skills ativas neste projeto:**
- `ui-ux` — em toda fase com interface (obrigatório)
- `frontend-patterns` — componentes e estado
- `backend-patterns` — API routes e queries
- `coding-standards` — qualidade e nomenclatura
- `security-review` — auth, webhooks, secrets
- `verification-loop` — build + tipos + lint após cada plan
- `strategic-compact` — compactar entre fases, nunca dentro de uma fase
<!-- GSD:profile-end -->

---

## Variáveis de Ambiente — Estrutura Segura

```bash
# ─── PÚBLICO (pode usar NEXT_PUBLIC_ — exposto no browser) ───
NEXT_PUBLIC_SUPABASE_URL=https://lmvdruvmpybutmmidrfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # anon key do painel Supabase

# ─── PRIVADO (somente server-side — NUNCA com NEXT_PUBLIC_) ───
SUPABASE_SERVICE_ROLE_KEY=           # ⚠️ root access — só em API routes
WHATSAPP_ACCESS_TOKEN=               # token permanente Meta
WHATSAPP_PHONE_NUMBER_ID=            # ID do número Meta
WHATSAPP_BUSINESS_ACCOUNT_ID=        # ID conta Business Meta
WHATSAPP_APP_SECRET=                 # valida assinatura HMAC do webhook
WHATSAPP_VERIFY_TOKEN=               # verifica webhook na Meta
N8N_WEBHOOK_URL=                     # URL do N8N que processa mensagens
N8N_WEBHOOK_SECRET=                  # autenticação Next.js → N8N
ANTHROPIC_API_KEY=                   # Claude API
```

**Regra absoluta:** `SUPABASE_SERVICE_ROLE_KEY` nunca deve aparecer em:
- Qualquer arquivo com `'use client'`
- Qualquer variável com prefixo `NEXT_PUBLIC_`
- Qualquer log ou console.log
- Qualquer resposta de API route retornada ao cliente

## Checklist de Segurança (verificar antes de qualquer commit)

- [ ] `.env.local` está listado no `.gitignore`
- [ ] Nenhum arquivo com `'use client'` usa `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Webhook `/api/webhooks/whatsapp` valida `X-Hub-Signature-256` antes de processar
- [ ] Webhook `/api/webhooks/n8n` valida `N8N_WEBHOOK_SECRET` no header
- [ ] Toda API route chama `auth.getUser()` como primeira operação
- [ ] `ANTHROPIC_API_KEY` usada somente em API routes ou N8N
- [ ] Sem `console.log` com dados sensíveis (tokens, números de telefone)
