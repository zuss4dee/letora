-- Persist full onboarding row payloads for each portfolio import batch (enables retrying failed rows without re-upload).

alter table public.batch_imports
  add column if not exists source_rows_json jsonb;

comment on column public.batch_imports.source_rows_json is
  'Frozen BatchOnboardingRow[] as imported/previewed before execution (same order as row indices). Enables retry-import of failed subset.';
