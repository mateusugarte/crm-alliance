# Campaign Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Adicionar 6 features às campanhas de disparo: visual de execução, timer ampliado, adicionar contatos, schedule por horário, excluir dispatch, excluir/editar campanha.

**Architecture:** DB migration adiciona colunas de horário. Novos API routes cobrem delete/patch de campanha e add-contacts. UI detail page ganha running state, timer, painel de contatos e ações de exclusão. Wizard ganha selects de horário na config.

**Tech Stack:** Next.js 15 App Router, Supabase, Framer Motion, Tailwind CSS, TypeScript

---

## File Map

- CREATE: `009_campaign_schedule.sql` — migration de horários
- MODIFY: `src/lib/supabase/types.ts` — adicionar campos allowed_hours_*
- MODIFY: `src/app/api/campaigns/[id]/route.ts` — GET já existe, adicionar PATCH + DELETE
- CREATE: `src/app/api/campaigns/[id]/contacts/route.ts` — POST add contacts
- MODIFY: `src/app/api/campaigns/[id]/dispatches/[dispatchId]/route.ts` — adicionar DELETE
- MODIFY: `src/app/api/campaigns/[id]/[action]/route.ts` — validar allowed_hours no start
- MODIFY: `src/app/(protected)/disparos/[id]/page.tsx` — running state, timer, add contacts, delete dispatch, delete/edit campaign
- MODIFY: `src/app/(protected)/disparos/page.tsx` — delete/edit na lista TabCampanhas
- MODIFY: `src/app/(protected)/disparos/novo/page.tsx` — schedule no step 3

---

- [ ] **Task 1: DB migration**
- [ ] **Task 2: Types update**
- [ ] **Task 3: API routes**
- [ ] **Task 4: Detail page**
- [ ] **Task 5: List page**
- [ ] **Task 6: Wizard schedule**
- [ ] **Task 7: Commit**
