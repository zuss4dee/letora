-- Per-user agent memory (key/value; loaded into ContextLoader)
create table if not exists public.user_agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_key text not null,
  memory_key text not null,
  memory_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, agent_key, memory_key)
);

alter table public.user_agent_memory enable row level security;

drop policy if exists "Users manage own agent memory" on public.user_agent_memory;
create policy "Users manage own agent memory"
  on public.user_agent_memory
  for all
  using (auth.uid() = user_id);

-- OTA / pipeline step audit
create table if not exists public.agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  step_index int not null,
  step_type text not null,
  tool_name text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_run_steps_user_created_idx
  on public.agent_run_steps (user_id, created_at desc);

alter table public.agent_run_steps enable row level security;

drop policy if exists "Users manage own agent run steps" on public.agent_run_steps;
create policy "Users manage own agent run steps"
  on public.agent_run_steps
  for all
  using (auth.uid() = user_id);

-- Opt-in transactional auto-send for rent chaser
alter table public.user_settings
  add column if not exists auto_chase_email boolean not null default false;
