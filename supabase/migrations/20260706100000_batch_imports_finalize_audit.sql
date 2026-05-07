-- Optional importer diagnostics surfaced when finalize UPDATE fails repeatedly.
alter table public.batch_imports add column if not exists finalize_error text;

comment on column public.batch_imports.finalize_error is
  'Last finalize persistence diagnostics (nullable). Apply migration before relying on importer writes into this column.';
