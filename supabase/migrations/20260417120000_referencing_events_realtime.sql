-- Broadcast INSERTs to subscribed clients (dashboard toast + refresh when agency replies).
alter publication supabase_realtime add table public.referencing_events;
