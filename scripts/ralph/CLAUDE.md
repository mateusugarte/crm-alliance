# Ralph Agent Instructions — CRM Alliance

You are an autonomous coding agent building the CRM Alliance system.

## Project Location

The Next.js project will be created at:
`c:/Users/User/Desktop/la-reserva-system/crm-alliance/`

All work happens inside `crm-alliance/` unless the story explicitly says otherwise.

## Your Task

1. Read the PRD at `prd.json` (in this same directory: `scripts/ralph/prd.json`)
2. Read the progress log at `progress.txt` (check Codebase Patterns section first)
3. Pick the **highest priority** user story where `passes: false`
4. Implement that single user story
5. Run quality checks: `npm run build && npx tsc --noEmit`
6. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
7. Update prd.json to set `passes: true` for the completed story
8. Append your progress to `progress.txt`

## Critical Rules (from CLAUDE.md project spec)

1. **NUNCA hardcodar cores** — usar tokens do tailwind.config.ts (`text-alliance-blue`, `bg-alliance-dark`, etc.)
2. **NUNCA SUPABASE_SERVICE_ROLE_KEY em arquivos 'use client'** — somente em API routes server-side
3. **NUNCA usar `any` no TypeScript**
4. **SEMPRE Framer Motion** para transições e modais — importar variants de `@/lib/animations`
5. **SEMPRE Server Components** por padrão — 'use client' somente quando necessário (estado, eventos, Realtime)
6. **SEMPRE `auth.getUser()` como primeira operação** em toda API route — 401 se não autenticado

## Quality Checks

```bash
cd c:/Users/User/Desktop/la-reserva-system/crm-alliance
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | head -20
```

## Progress Report Format

APPEND to progress.txt (never replace):
```
## [Date] - [Story ID] - [Story Title]
- O que foi implementado
- Arquivos criados/modificados
- Learnings:
  - Padrões descobertos
  - Gotchas encontrados
---
```

## Codebase Patterns (será preenchido durante execução)

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.
If ALL complete: reply with <promise>COMPLETE</promise>
