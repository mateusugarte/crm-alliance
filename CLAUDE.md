# CRM Alliance — La Reserva

## Objetivo
CRM web para a Alliance Investimentos Imobiliários gerenciar leads do La Reserva captados via WhatsApp. Um agente de IA qualifica leads automaticamente via WhatsApp Business API (Meta). Corretores acompanham em tempo real, assumem conversas, gerenciam reuniões e visualizam histórico completo.

**5 usuários:** Lucas, João, Marco, Jaque (corretores) + ADM
**Produto:** La Reserva — 34 unidades de alto padrão em Castelo, ES

## Stack Atual
- **Frontend:** Next.js 15 App Router + TypeScript + Tailwind CSS
- **UI:** shadcn/ui + Framer Motion + dnd-kit (Kanban)
- **Banco:** Supabase (PostgreSQL + Auth + RLS + Realtime)
- **WhatsApp:** Meta Cloud API oficial — N8N (Railway) orquestra o fluxo
- **Deploy:** Vercel (frontend) + Railway (N8N)

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/login/           ← autenticação (fora do layout principal)
│   ├── (protected)/            ← rotas protegidas com NavShell
│   │   ├── dashboard/
│   │   ├── kanban/
│   │   ├── agenda/
│   │   ├── imoveis/
│   │   └── interacoes/
│   └── api/
│       ├── leads/[id]/         ← assign | pause | move-stage | send-message | interactions | labels
│       ├── meetings/[id]/
│       ├── imoveis/[id]/
│       ├── labels/
│       └── webhooks/           ← whatsapp (Meta) | n8n (N8N → CRM)
├── components/
│   ├── ui/                     ← shadcn/ui — não editar manualmente
│   ├── layout/                 ← NavShell, AnimatedLayout, blobs
│   ├── kanban/                 ← KanbanBoard, LeadCard, LeadDetailModal, LabelsSection, ChatSection
│   ├── dashboard/              ← MetricCard, ActivityChart, MetricsGrid
│   ├── agenda/                 ← AgendaClient, MeetingPill, MeetingFormPanel
│   ├── imoveis/                ← ImovelCard, ImovelGrid, ImovelFormPanel
│   └── interacoes/             ← InteracoesClient, ChatArea, LeadsSidebar, MessageBubble
└── lib/
    ├── supabase/               ← client.ts | server.ts | service.ts | types.ts
    ├── animations.ts           ← pageTransition, modalAnimation, staggerContainer, staggerItem
    ├── format-phone.ts         ← formatPhone() — strips @s.whatsapp.net, formata número BR
    ├── utils.ts                ← cn() helper (shadcn/ui)
    └── utils/format.ts         ← formatCurrency(), formatDate()
```

## Convenções Críticas

- **Server Components por padrão** — `'use client'` só quando necessário (hooks, Framer Motion, dnd-kit)
- **Supabase:** browser → `@/lib/supabase/client` | server → `server` | bypass RLS → `service`
- **Cores:** tokens Tailwind (`text-alliance-blue`, `bg-alliance-dark`) ou `var(--color-stage-*)` — NUNCA hex hardcoded em componentes com token equivalente
- **date-fns v3.6.0** — NÃO usar v4 (bug ESM com `formatRelative`)
- **selectedLeadId:** sempre `string | null` como estado — nunca objeto `Lead` inteiro
- **Webhook N8N:** usa `createServiceClient` (service role) para bypassar RLS
- **Middleware:** usa `getUser()` — nunca `getSession()` (pode ser spoofado)

## API Routes Mapeadas

| Endpoint | Método | Ação |
|----------|--------|------|
| `/api/leads` | GET/POST | lista todos / cria lead manual |
| `/api/leads/[id]` | GET/PUT/DELETE | busca (com labels) / edita / deleta |
| `/api/leads/[id]/assign` | POST | atribui ao usuário logado |
| `/api/leads/[id]/pause` | POST | toggle automation_paused |
| `/api/leads/[id]/move-stage` | POST | move stage via RPC atômica |
| `/api/leads/[id]/send-message` | POST | envia mensagem WhatsApp via Meta API |
| `/api/leads/[id]/interactions` | GET/POST | histórico de chat / envia mensagem manual |
| `/api/leads/[id]/labels` | GET/POST/DELETE | etiquetas do lead |
| `/api/labels` | GET/POST | etiquetas globais |
| `/api/meetings` | GET/POST | agenda / cria reunião |
| `/api/meetings/[id]` | PUT/DELETE | edita / deleta reunião |
| `/api/imoveis` | GET/POST | catálogo (POST: ADM only) |
| `/api/imoveis/[id]` | PUT/DELETE | edita / deleta (ADM only) |
| `/api/imoveis/[id]/toggle` | POST | toggle disponibilidade |
| `/api/webhooks/whatsapp` | GET/POST | verificação Meta + repasse ao N8N |
| `/api/webhooks/n8n` | POST | recebe do N8N → atualiza lead + insere interaction |

## Payload N8N → CRM (`POST /api/webhooks/n8n`)

```json
{
  "lead_id": "uuid",
  "stage": "lead_quente",
  "summary": "Resumo gerado pela IA",
  "interaction": {
    "direction": "inbound",
    "content": "Texto da mensagem",
    "wa_message_id": "wamid.xxx"
  }
}
```
Header obrigatório: `x-webhook-secret: <N8N_WEBHOOK_SECRET>`

## Variáveis de Ambiente

```bash
# Público (browser)
NEXT_PUBLIC_SUPABASE_URL=https://lmvdruvmpybutmmidrfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Privado (somente server-side — NUNCA com NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=      # ⚠️ root access — só em API routes e service.ts
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=            # valida assinatura HMAC do webhook Meta
WHATSAPP_VERIFY_TOKEN=
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

## Segurança — Regras Absolutas

1. `SUPABASE_SERVICE_ROLE_KEY` nunca em arquivos `'use client'`, nunca em `NEXT_PUBLIC_`, nunca em logs
2. Webhook Meta valida `X-Hub-Signature-256` (HMAC SHA256) antes de processar qualquer payload
3. Webhook N8N valida `N8N_WEBHOOK_SECRET` no header — sempre obrigatório, sem bypass
4. Toda API route chama `auth.getUser()` como primeira operação — retorna 401 se não autenticado
5. Graph API: usar sempre versão v21+ (não v18)
