-- Referencing agency defaults, per-tenancy token, inbound/outbound event log

alter table public.user_settings
  add column if not exists referencing_agency_name text;

alter table public.user_settings
  add column if not exists referencing_agency_email text;

alter table public.user_settings
  add column if not exists referencing_agency_notes text;

alter table public.user_settings
  add column if not exists auto_send_referencing_emails boolean not null default false;

alter table public.tenancies
  add column if not exists referencing_token uuid;

alter table public.tenancies
  add column if not exists referencing_agency_email_override text;

alter table public.tenancies
  add column if not exists referencing_last_outbound_at timestamptz;

alter table public.tenancies
  add column if not exists referencing_last_inbound_at timestamptz;

create unique index if not exists tenancies_referencing_token_uidx
  on public.tenancies (referencing_token)
  where referencing_token is not null;

create table if not exists public.referencing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  email_log_id uuid references public.email_logs (id) on delete set null,
  subject text,
  body_preview text,
  raw_payload jsonb,
  outcome text,
  created_at timestamptz not null default now()
);

create index if not exists referencing_events_user_created_idx
  on public.referencing_events (user_id, created_at desc);

create index if not exists referencing_events_tenancy_idx
  on public.referencing_events (tenancy_id, created_at desc);

alter table public.referencing_events enable row level security;

drop policy if exists "Users manage own referencing events" on public.referencing_events;

create policy "Users manage own referencing events"
  on public.referencing_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
