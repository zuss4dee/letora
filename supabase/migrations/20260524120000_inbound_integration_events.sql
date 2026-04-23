-- Append-only inbound events for feeders and internal producers (control-plane traceability).

create table if not exists public.inbound_integration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  source text not null,
  type text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'processed', 'failed', 'ignored')),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.inbound_integration_events is
  'Inbound structured events from feeders and internal callers; processed asynchronously or inline.';

create unique index if not exists inbound_integration_events_idempotency_key_uidx
  on public.inbound_integration_events (idempotency_key)
  where idempotency_key is not null;

create index if not exists inbound_integration_events_user_created_idx
  on public.inbound_integration_events (user_id, created_at desc);

alter table public.inbound_integration_events enable row level security;

drop policy if exists "inbound_integration_events_select_own" on public.inbound_integration_events;
create policy "inbound_integration_events_select_own"
  on public.inbound_integration_events
  for select
  to authenticated
  using (user_id is not null and auth.uid() = user_id);

drop policy if exists "inbound_integration_events_insert_own" on public.inbound_integration_events;
create policy "inbound_integration_events_insert_own"
  on public.inbound_integration_events
  for insert
  to authenticated
  with check (user_id is not null and auth.uid() = user_id);
