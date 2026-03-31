-- Phase 1: email_logs + user_settings email automation columns

alter table public.user_settings
  add column if not exists email_from_name text;

alter table public.user_settings
  add column if not exists auto_send_rent_chaser boolean not null default false;

alter table public.user_settings
  add column if not exists auto_send_maintenance_updates boolean not null default false;

alter table public.user_settings
  add column if not exists auto_send_onboarding_emails boolean not null default false;

alter table public.user_settings
  add column if not exists auto_send_lead_updates boolean not null default false;

-- Migrate legacy toggle only if column exists (plain UPDATE fails parse when column is missing)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'auto_chase_email'
  ) then
    execute 'update public.user_settings set auto_send_rent_chaser = coalesce(auto_chase_email, false)';
  end if;
end;
$$;

alter table public.user_settings drop column if exists auto_chase_email;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  agent_type text not null,
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  status text not null check (status in ('draft', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_user_created_idx
  on public.email_logs (user_id, created_at desc);

create index if not exists email_logs_user_status_idx
  on public.email_logs (user_id, status);

alter table public.email_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_logs' and policyname = 'Users manage own email logs'
  ) then
    create policy "Users manage own email logs"
      on public.email_logs
      for all
      using (auth.uid() = user_id);
  end if;
end
$$;
