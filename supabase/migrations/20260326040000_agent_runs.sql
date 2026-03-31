create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_type text not null,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_runs enable row level security;

drop policy if exists "Users can manage own agent runs" on public.agent_runs;
create policy "Users can manage own agent runs"
  on public.agent_runs
  for all
  using (auth.uid() = user_id);
