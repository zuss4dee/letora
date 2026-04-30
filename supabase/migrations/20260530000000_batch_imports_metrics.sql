-- Add agentic metrics to batch_imports for history tracking
alter table public.batch_imports 
  add column if not exists agents_triggered int not null default 0,
  add column if not exists approvals_created int not null default 0;
