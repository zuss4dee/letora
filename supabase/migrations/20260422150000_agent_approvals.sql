create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  agent_type text not null,
  title text not null,
  summary text,
  action_type text not null,
  target_type text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired', 'executed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  deny_reason text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.agent_approvals enable row level security;
create policy "agent_approvals_select_own"
on public.agent_approvals
for select
to authenticated
using (auth.uid() = user_id);
create policy "agent_approvals_insert_own"
on public.agent_approvals
for insert
to authenticated
with check (auth.uid() = user_id);
create policy "agent_approvals_update_own"
on public.agent_approvals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create index if not exists agent_approvals_user_status_created_idx
on public.agent_approvals(user_id, status, created_at desc);
create index if not exists agent_approvals_run_idx
on public.agent_approvals(agent_run_id);
