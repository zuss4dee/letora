-- Phase 2: tenant onboarding agent — status on tenancies + onboarding_tasks

alter table public.tenancies
  add column if not exists onboarding_status text not null default 'not_started';

alter table public.tenancies
  drop constraint if exists tenancies_onboarding_status_check;

alter table public.tenancies
  add constraint tenancies_onboarding_status_check
  check (onboarding_status in (
    'not_started',
    'in_progress',
    'references',
    'contract_sent',
    'complete'
  ));

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_name text not null,
  task_type text not null,
  status text not null default 'pending' check (status in ('pending', 'complete', 'skipped')),
  email_log_id uuid references public.email_logs (id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_tasks_tenancy_id_idx
  on public.onboarding_tasks (tenancy_id);

create index if not exists onboarding_tasks_user_status_idx
  on public.onboarding_tasks (user_id, status);

alter table public.onboarding_tasks enable row level security;

drop policy if exists "Users manage own onboarding tasks" on public.onboarding_tasks;

create policy "Users manage own onboarding tasks"
  on public.onboarding_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
