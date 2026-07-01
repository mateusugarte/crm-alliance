# Lead Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internal comments to lead cards — visible both in the Kanban's `LeadDetailModal` and the Interações `LeadInfoPanel` — stored in a dedicated `lead_comments` table.

**Architecture:** New `lead_comments` table (separate from `interactions`, which is WhatsApp history). Shared React component `LeadCommentsSection` used in both views. Single API route handles GET/POST/DELETE. Realtime subscription for INSERT keeps comments live without polling.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS + Realtime), shadcn/ui, Framer Motion (none needed here), Sonner toasts, date-fns v3.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `010_lead_comments.sql` | DB migration — table, RLS, realtime |
| Modify | `src/lib/supabase/types.ts` | Add `lead_comments` table + `LeadComment` export |
| Create | `src/app/api/leads/[id]/comments/route.ts` | GET list / POST create / DELETE own comment |
| Create | `src/components/shared/lead-comments-section.tsx` | Reusable comments UI |
| Modify | `src/components/kanban/lead-detail-modal.tsx` | Add `currentUserId` prop + comments section |
| Modify | `src/components/kanban/kanban-board.tsx` | Pass `currentUserId` to `LeadDetailModal` |
| Modify | `src/components/interacoes/lead-info-panel.tsx` | Add comments section |

---

## Task 1: SQL migration

**Files:**
- Create: `010_lead_comments.sql` (project root)

- [ ] **Step 1: Write the migration file**

```sql
-- 010_lead_comments.sql
CREATE TABLE IF NOT EXISTS lead_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  user_name   text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lead comments"
  ON lead_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own comments"
  ON lead_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON lead_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE lead_comments;
```

- [ ] **Step 2: Run the migration**

Open the Supabase Dashboard → SQL Editor → paste and run the contents of `010_lead_comments.sql`.

Expected: no error, table appears in Table Editor.

- [ ] **Step 3: Verify**

In Supabase → Table Editor → `lead_comments`: confirm columns `id, lead_id, user_id, user_name, content, created_at` exist and RLS is enabled.

In Supabase → Realtime → Tables: confirm `lead_comments` is listed.

---

## Task 2: TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add `lead_comments` to the `Tables` block**

Find the closing of the `lead_labels` block (around line 296) and insert before the `wa_instances` block:

```ts
      lead_comments: {
        Row: {
          id: string
          lead_id: string
          user_id: string
          user_name: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id: string
          user_name: string
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['lead_comments']['Insert']>
      }
```

- [ ] **Step 2: Add convenience export at bottom of file**

After the existing exports (around line 509), add:

```ts
export type LeadComment = Database['public']['Tables']['lead_comments']['Row']
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

---

## Task 3: API route

**Files:**
- Create: `src/app/api/leads/[id]/comments/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT_FIELDS = 'id, lead_id, user_id, user_name, content, created_at'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('lead_comments')
    .select(SELECT_FIELDS)
    .eq('lead_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { content?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content é obrigatório' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = (profile as { full_name: string } | null)?.full_name ?? 'Corretor'

  const { data, error } = await supabase
    .from('lead_comments')
    .insert({
      lead_id: id,
      user_id: user.id,
      user_name: userName,
      content: body.content.trim(),
    })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const commentId = searchParams.get('commentId')
  if (!commentId) {
    return NextResponse.json({ error: 'commentId é obrigatório' }, { status: 400 })
  }

  const { id } = await params

  // RLS enforces auth.uid() = user_id — no explicit owner check needed here
  const { error } = await supabase
    .from('lead_comments')
    .delete()
    .eq('id', commentId)
    .eq('lead_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no new errors.

---

## Task 4: Shared `LeadCommentsSection` component

**Files:**
- Create: `src/components/shared/lead-comments-section.tsx`

> Note: create `src/components/shared/` directory if it doesn't exist.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Send, Trash2, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { LeadComment } from '@/lib/supabase/types'

interface LeadCommentsSectionProps {
  leadId: string
  currentUserId: string
}

export function LeadCommentsSection({ leadId, currentUserId }: LeadCommentsSectionProps) {
  const [comments, setComments] = useState<LeadComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/leads/${leadId}/comments`)
      .then(r => r.json() as Promise<{ data: LeadComment[] }>)
      .then(json => setComments(json.data ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`comments-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_comments', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setComments(prev => {
            const c = payload.new as LeadComment
            if (prev.some(x => x.id === c.id)) return prev
            return [...prev, c]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leadId])

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments])

  const handleSubmit = async () => {
    const text = newComment.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: LeadComment }
      setComments(prev => [...prev, json.data])
      setNewComment('')
    } catch {
      toast.error('Erro ao adicionar comentário')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      const res = await fetch(`/api/leads/${leadId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {
      toast.error('Erro ao excluir comentário')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Comment list */}
      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-gray-300" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
            <StickyNote size={18} className="text-gray-200" />
            <p className="text-xs text-gray-300">Nenhum comentário ainda.</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex items-start gap-1.5 group">
              <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    {c.user_name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 p-1 text-gray-300 hover:text-red-400 disabled:opacity-40 cursor-pointer rounded-lg hover:bg-red-50"
                  aria-label="Excluir comentário"
                >
                  {deletingId === c.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />
                  }
                </button>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Comentário interno... (Enter para enviar)"
          rows={2}
          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 leading-snug"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          aria-label="Enviar comentário"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-alliance-dark text-white rounded-full hover:bg-alliance-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
        >
          {submitting
            ? <Loader2 size={13} className="animate-spin" />
            : <Send size={13} />
          }
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Wire into `LeadDetailModal` (Kanban pipeline)

**Files:**
- Modify: `src/components/kanban/lead-detail-modal.tsx`
- Modify: `src/components/kanban/kanban-board.tsx`

### 5a — Add `currentUserId` prop to `LeadDetailModal`

- [ ] **Step 1: Update the props interface**

In `lead-detail-modal.tsx`, find the `LeadDetailModalProps` interface (around line 69) and add `currentUserId`:

Old:
```ts
interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onAssume?: () => void
  onTogglePause?: () => void
  onLeadUpdated?: (updatedLead: Lead) => void
  onLeadDeleted?: (leadId: string) => void
}
```

New:
```ts
interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onAssume?: () => void
  onTogglePause?: () => void
  onLeadUpdated?: (updatedLead: Lead) => void
  onLeadDeleted?: (leadId: string) => void
  currentUserId: string
}
```

- [ ] **Step 2: Add the prop to the function signature**

Old:
```ts
export function LeadDetailModal({
  lead,
  open,
  onClose,
  onAssume,
  onTogglePause,
  onLeadUpdated,
  onLeadDeleted,
}: LeadDetailModalProps) {
```

New:
```ts
export function LeadDetailModal({
  lead,
  open,
  onClose,
  onAssume,
  onTogglePause,
  onLeadUpdated,
  onLeadDeleted,
  currentUserId,
}: LeadDetailModalProps) {
```

- [ ] **Step 3: Add the import for `LeadCommentsSection`**

Add to the imports at the top of `lead-detail-modal.tsx`:

```ts
import { LeadCommentsSection } from '@/components/shared/lead-comments-section'
```

- [ ] **Step 4: Add the Comentários section after "Conversas" section**

Find the divider + Conversas section (around line 525–540):
```tsx
              <div className="border-t border-gray-100" />

              {/* Conversas */}
              <section>
                <SectionTitle>Conversas</SectionTitle>
                <LeadChatSection
                  ...
                />
              </section>

              <div className="border-t border-gray-100" />

              {/* Ações */}
```

Insert a new section between "Conversas" divider and "Ações":

```tsx
              <div className="border-t border-gray-100" />

              {/* Comentários internos */}
              <section>
                <SectionTitle>Comentários internos</SectionTitle>
                <LeadCommentsSection
                  leadId={displayLead.id}
                  currentUserId={currentUserId}
                />
              </section>

              <div className="border-t border-gray-100" />

              {/* Ações */}
```

### 5b — Pass `currentUserId` from `KanbanBoard`

- [ ] **Step 5: Update the `<LeadDetailModal>` call in `kanban-board.tsx`**

Find the `<LeadDetailModal>` JSX (around line 148) and add the prop:

Old:
```tsx
      <LeadDetailModal
        lead={selectedLead}
        open={selectedLead !== null}
        onClose={() => setSelectedLeadId(null)}
        onAssume={() => selectedLead && handleAssume(selectedLead.id)}
        onTogglePause={() => selectedLead && handleTogglePause(selectedLead.id)}
        onLeadUpdated={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
        onLeadDeleted={(leadId) => {
          setLeads(prev => prev.filter(l => l.id !== leadId))
          setSelectedLeadId(null)
        }}
      />
```

New:
```tsx
      <LeadDetailModal
        lead={selectedLead}
        open={selectedLead !== null}
        onClose={() => setSelectedLeadId(null)}
        onAssume={() => selectedLead && handleAssume(selectedLead.id)}
        onTogglePause={() => selectedLead && handleTogglePause(selectedLead.id)}
        onLeadUpdated={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
        onLeadDeleted={(leadId) => {
          setLeads(prev => prev.filter(l => l.id !== leadId))
          setSelectedLeadId(null)
        }}
        currentUserId={currentUserId}
      />
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Wire into `LeadInfoPanel` (Interações)

**Files:**
- Modify: `src/components/interacoes/lead-info-panel.tsx`

- [ ] **Step 1: Add the import for `LeadCommentsSection`**

At the top of `lead-info-panel.tsx`, add:

```ts
import { LeadCommentsSection } from '@/components/shared/lead-comments-section'
```

- [ ] **Step 2: Add comments section in the scrollable content area**

Find the `{/* Summary */}` block (around line 256) and the closing `</div>` of the content div (before the Footer). Add the comments section after the summary block:

```tsx
              {/* Comentários internos */}
              <div className="h-px bg-gray-100 dark:bg-white/5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
                  Comentários internos
                </p>
                <LeadCommentsSection
                  leadId={lead.id}
                  currentUserId={currentUserId}
                />
              </div>
```

(Insert this between the `{lead.summary && ...}` block and the closing `</div>` of the scrollable content area, before the Footer `<div className="px-5 py-4 flex-shrink-0 ...">`)

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: Build & manual verification

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test in Kanban (pipeline)**

1. Open the app at `/kanban`
2. Click any lead card → Sheet opens on the right
3. Scroll to **Comentários internos** section
4. Type a comment, press Enter or click the send button
5. Confirm comment appears in amber card with your name and timestamp
6. Hover over own comment → delete button appears
7. Click delete → comment disappears

- [ ] **Step 3: Test in Interações**

1. Navigate to `/interacoes`
2. Select a lead in the sidebar
3. Click the info icon (top right of chat) → `LeadInfoPanel` opens
4. Scroll down to **Comentários internos**
5. Add a comment — confirm it appears
6. Open the same lead in Kanban → confirm the same comment is visible there too (shared data)

- [ ] **Step 4: Test Realtime**

1. Open the same lead in two browser tabs (one Kanban, one Interações)
2. Add a comment in one tab
3. Confirm it appears in the other tab without refresh

- [ ] **Step 5: Full build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript or build errors.

- [ ] **Step 6: Commit**

```bash
git add 010_lead_comments.sql \
  src/lib/supabase/types.ts \
  src/app/api/leads/[id]/comments/route.ts \
  src/components/shared/lead-comments-section.tsx \
  src/components/kanban/lead-detail-modal.tsx \
  src/components/kanban/kanban-board.tsx \
  src/components/interacoes/lead-info-panel.tsx
git commit -m "feat: adicionar comentários internos nos cards de lead (kanban + interações)"
```
