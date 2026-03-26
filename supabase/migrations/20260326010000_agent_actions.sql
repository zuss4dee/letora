create table if not exists public.agent_actions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  agent_type text not null,
  status text not null default 'draft',
  payload jsonb not null,
  created_at timestamptz default now()
);

alter table public.agent_actions enable row level security;

create policy "Users can manage their own agent actions"
on public.agent_actions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

