-- Audit log for lead summary standardization batches.
-- Keeps old/new text so large summary updates can be reviewed or reverted.

create table if not exists public.lead_summary_rewrite_audit (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  old_summary text,
  new_summary text not null,
  generated_by text not null default 'deterministic_v1',
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_summary_rewrite_audit_lead_id_idx
  on public.lead_summary_rewrite_audit(lead_id);

create index if not exists lead_summary_rewrite_audit_created_at_idx
  on public.lead_summary_rewrite_audit(created_at desc);
