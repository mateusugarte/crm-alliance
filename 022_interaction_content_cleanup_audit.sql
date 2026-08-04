-- Audit log da limpeza de interactions.content gravados como payload cru do WhatsApp.
-- Guarda o texto original para que a limpeza possa ser revisada ou revertida.

create table if not exists public.interaction_content_cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  old_content text not null,
  new_content text not null,
  cleaned_by text not null default 'extract_message_text_v1',
  created_at timestamptz not null default now()
);

create index if not exists interaction_content_cleanup_audit_interaction_id_idx
  on public.interaction_content_cleanup_audit(interaction_id);

create index if not exists interaction_content_cleanup_audit_created_at_idx
  on public.interaction_content_cleanup_audit(created_at desc);
