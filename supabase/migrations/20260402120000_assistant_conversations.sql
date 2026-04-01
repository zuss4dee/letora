-- Multi-thread CEO assistant: conversations + messages scoped per thread

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_conversations_user_updated_idx
  on public.assistant_conversations (user_id, updated_at desc);

alter table public.assistant_conversations enable row level security;

drop policy if exists "Users manage own assistant conversations" on public.assistant_conversations;
create policy "Users manage own assistant conversations"
  on public.assistant_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.assistant_messages
  add column if not exists conversation_id uuid references public.assistant_conversations(id) on delete cascade;

-- Backfill: one legacy conversation per user that already has messages
insert into public.assistant_conversations (user_id, title)
select distinct on (m.user_id) m.user_id, 'Legacy chat'
from public.assistant_messages m
where m.conversation_id is null
order by m.user_id;

update public.assistant_messages am
set conversation_id = (
  select ac.id
  from public.assistant_conversations ac
  where ac.user_id = am.user_id
    and ac.title = 'Legacy chat'
  order by ac.created_at asc
  limit 1
)
where am.conversation_id is null;

alter table public.assistant_messages
  alter column conversation_id set not null;

drop index if exists assistant_messages_user_created_idx;

create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at desc);

create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);
