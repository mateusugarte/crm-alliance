# Decisões de Arquitetura — CRM Alliance

**Produzido por:** alliance-architect
**Revisão:** 2026-03-30 (auditoria pós-Phase 8, pré-Phase 9)
**Base:** Leitura completa de layout.tsx, middleware.ts, types.ts, animations.ts, package.json,
         todos os API routes, kanban-board.tsx, interacoes-client.tsx, whatsapp/send.ts

---

## Decisões bloqueadas (não negociáveis)

- **App Router Next.js — sem Pages Router** — toda roteação usa `app/` com layouts aninhados; Server Components são o padrão; `'use client'` explícito onde necessário
- **`SUPABASE_SERVICE_ROLE_KEY` exclusivamente em API routes server-side** — nunca em Client Components, nunca com prefixo `NEXT_PUBLIC_`, nunca em logs; uso atual correto em `src/lib/supabase/service.ts`
- **HMAC SHA256 antes de qualquer processamento no webhook Meta** — `request.text()` lido antes de `JSON.parse`; `crypto.timingSafeEqual` obrigatório; implementação atual CORRETA
- **`auth.getUser()` como primeira operação em toda API route autenticada** — retornar 401 imediatamente se não autenticado; padrão seguido em todas as rotas existentes
- **Meta Cloud API oficial (graph.facebook.com/v18.0)** — sem Evolution API ou wrappers não oficiais; sendTextMessage e sendTemplateMessage em `lib/whatsapp/send.ts` seguem esse padrão
- **Supabase Realtime para atualizações ao vivo** — Kanban e Interações usam `supabase.channel()` com subscription; nenhum polling; implementação atual CORRETA
- **TypeScript estrito** — `tsconfig.json` com `"strict": true`; os `as never` e `as any` nos routes de update são débito técnico aceitável até migração de tipos Supabase v2; documentar cada ocorrência
- **shadcn/ui como base de componentes UI** — arquivos em `src/components/ui/` não editados manualmente; customizações via tokens Tailwind
- **Framer Motion obrigatório em toda transição de página e modal** — `pageTransition` e `modalAnimation` em `lib/animations.ts` são o padrão; `prefers-reduced-motion` ainda não implementado — DÍVIDA TÉCNICA
- **RLS ativo em todas as 7 tabelas** — service_role bypassa RLS somente em contexto server-side documentado
- **`interactions` imutável pelo cliente** — sem UPDATE/DELETE para usuários autenticados; histórico de mensagens é permanente
- **Seed de imóveis no schema SQL** — sem CRUD de imóveis no v1; dados estáticos
- **Rate limiting obrigatório no webhook WhatsApp antes do deploy de produção** — sem limite, um burst de mensagens pode esgotar Function invocations no plano Vercel e acumular writes no Supabase sem controle
- **Disparos HSM (Phase 9) exclusivamente via service_role + N8N** — nunca via ANON_KEY; respeitar janela de 24h da Meta e limite de throughput por número de telefone

---

## Riscos identificados (ordenados por severidade)

### Risco 1 — Webhook WhatsApp sem rate limiting (CRÍTICO para produção)
O handler POST em `/api/webhooks/whatsapp/route.ts` repassa qualquer payload válido ao N8N sem limite de frequência. Em cenários de burst (campanha de inbound, loop de automação no N8N, ataque de replay), cada mensagem cria uma Vercel Function invocation e um write no Supabase. Com o plano Vercel Hobby (100k invocations/mês) e Supabase Free (500MB), um único dia de campanha pode exceder limites.
- Mitigação imediata: adicionar header de verificação de origem no repasse ao N8N; configurar no N8N um debounce de processamento por `wa_contact_id`; antes do deploy final, mover para plano Vercel Pro ou implementar um middleware de rate limiting via Edge Config

### Risco 2 — Interações carrega 500 mensagens em memória no servidor (ALTA escala)
Em `interacoes/page.tsx`, a query inicial traz `.limit(500)` de interações para os primeiros 50 leads e passa tudo como prop para o Client Component. Com 500 leads e histórico longo, esse número vai estourar. O `loadHistory` no cliente só é chamado se `existing.length === 0`, o que significa que leads carregados na hidratação inicial nunca recarregam do servidor — mensagens novas recebidas enquanto a tela está fechada não aparecem ao reabrir sem refresh.
- Mitigação: paginação cursor-based em `/api/interactions/[leadId]`; carregar apenas as últimas 30 mensagens na hidratação inicial; Realtime já cobre as mensagens novas em tempo real

### Risco 3 — N8N webhook sem validação de `stage` contra enum do banco (MÉDIA)
O handler `/api/webhooks/n8n/route.ts` aceita qualquer string em `body.stage` e a envia ao banco com `as LeadUpdate['stage']`. O TypeScript faz o cast mas não valida em runtime. Um N8N mal configurado pode gravar um stage inválido no banco, corrompendo o Kanban sem log de erro visível (o Supabase rejeitaria via constraint CHECK, retornando erro, que é logado — mas o operador não vê isso em produção sem observabilidade).
- Mitigação: adicionar validação Zod no handler N8N antes do update; os VALID_STAGES já estão definidos em `move-stage/route.ts` — extrair para constante compartilhada

### Risco 4 — `move-stage` usa `as any` para contornar tipo Supabase (BAIXA, mas sinal)
`/api/leads/[id]/move-stage/route.ts` linha 26 usa `(supabase.from('leads') as any).update(update)`. Isso indica que os tipos gerados do Supabase estão desalinhados com a estrutura real do banco. Se o schema mudou (campos adicionados para Phase 9) sem regenerar `types.ts`, outros routes podem estar silenciando erros de tipo reais.
- Mitigação: regenerar `types.ts` via `supabase gen types typescript` antes de iniciar Phase 9; isso eliminará todos os `as never` e `as any` nos routes

### Risco 5 — WhatsApp `send.ts` usa `graph.facebook.com/v18.0` hardcoded (BAIXA, mas prazo)
A versão v18.0 da Graph API foi deprecada. A Meta tem política de deprecação de versões a cada ~2 anos. Não é problema imediato mas precisa de upgrade para v21.0 ou superior antes do deploy de produção para garantir suporte completo a templates HSM da Phase 9.
- Mitigação: atualizar `BASE_URL` para `v21.0` e testar sendTextMessage + sendTemplateMessage antes da Phase 9

---

## Wave map — Phase 9 (Disparos + Deploy Final)

```
Wave 1 (pré-requisitos, sequencial — bloqueia tudo):
  P9-01 — Regenerar types.ts via supabase gen types
        — Atualizar BASE_URL whatsapp/send.ts para v21.0
        — Adicionar validação Zod em /api/webhooks/n8n/route.ts
        — Adicionar campo sender_id em interactions (schema migration)

Wave 2 (paralelo após Wave 1):
  P9-02 — UI de Broadcasts: listagem + status (draft/running/completed/cancelled)
        — Página /broadcasts acessível apenas para role 'adm'
  P9-03 — CSV upload: papaparse já instalado; componente de drag-drop + validação
        — Inserir linhas em broadcast_numbers via service_role

Wave 3 (depende de Wave 2, paralelo):
  P9-04 — API route POST /api/broadcasts/[id]/send
        — Lógica de disparo: iterar broadcast_numbers com status 'pending'
        — Rate limiting: 1 mensagem/segundo máximo (Meta HSM limit)
        — Atualizar sent/failed em tempo real via UPDATE
  P9-05 — Realtime no painel de broadcast: progresso ao vivo (sent/total)
        — Botão cancelar: marca status 'cancelled', para loop

Wave 4 (depende de Wave 3):
  P9-06 — Deploy final Vercel: variáveis de ambiente, vercel.json configurado
        — Smoke test em produção: webhook WhatsApp, kanban drag, broadcast draft
        — Configurar domínio customizado se aplicável
```

---

## Schema — ajustes necessários para Phase 9

- **`interactions.sender_id uuid`** — campo pendente desde Phase 0; necessário antes de Phase 9 para distinguir mensagens manuais de consultor vs. IA nos disparos de broadcast; adicionar `REFERENCES auth.users(id) ON DELETE SET NULL NULL`
- **`imoveis.created_at timestamp`** — campo ausente no schema atual; sem ele não é possível ordenar ou filtrar imóveis por data de cadastro no futuro; adicionar com `DEFAULT now()` sem breaking change
- **Índice em `interactions(lead_id, created_at DESC)`** — ausente; com crescimento de histórico de conversas, a tela de Interações vai degradar; criar antes de ir para produção com dados reais
- **Índice `idx_bcast_num_phone` em `broadcast_numbers(phone)`** — necessário para Phase 9; verificação de duplicatas em CSVs grandes é O(n) sem índice
- **Índice `idx_leads_updated` em `leads(updated_at DESC)`** — sidebar de Interações ordena por `updated_at`; sem índice, com 500+ leads começa a degradar
- **Trigger auto-insert em `user_profiles` após `auth.users` INSERT** — sem ele, qualquer novo usuário criado diretamente no Supabase Dashboard entra no sistema sem perfil e quebra a saudação do dashboard e os badges do Kanban

---

## Aprovado para iniciar construção: SIM

Phase 9 pode iniciar após completar Wave 1 (pré-requisitos técnicos acima).
Pré-condição adicional: templates HSM aprovados pela Meta devem estar com status APPROVED
no Business Manager antes de executar P9-04.
