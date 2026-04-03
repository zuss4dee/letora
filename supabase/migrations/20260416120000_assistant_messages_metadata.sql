-- Optional JSON metadata for assistant messages (e.g. suggested action chips).
alter table public.assistant_messages
  add column if not exists metadata jsonb;
