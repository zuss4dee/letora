-- Ensure `source` exists for Command Center / activity views (idempotent).
-- Mirrors 20260429120000_add_source_to_agent_activity.sql for DBs that never applied that migration.

alter table public.agent_activity
  add column if not exists source text default 'assistant';
