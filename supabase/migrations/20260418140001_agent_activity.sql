-- Agent activity logging for CEO tool calls

create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tool_name text not null,
  args jsonb,
  result jsonb,
  success boolean default true,
  created_at timestamptz default now()
);

create index if not exists agent_activity_user_created_idx
  on public.agent_activity (user_id, created_at desc);

alter table public.agent_activity enable row level security;

create policy "agent_activity_select_own" on public.agent_activity
  for select using (auth.uid() = user_id);

create policy "agent_activity_insert_own" on public.agent_activity
  for insert with check (auth.uid() = user_id);
