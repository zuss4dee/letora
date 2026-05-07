-- Row-level snapshot for portfolio import result page (preview warnings + outcome).
alter table public.batch_imports
  add column if not exists outcomes_json jsonb not null default '[]'::jsonb;

comment on column public.batch_imports.outcomes_json is
  'Per-row portfolio import snapshot: preview errors/warnings, prepare tags, and execution outcome.';
