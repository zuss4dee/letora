-- Batch imports: landlords uploading CSVs of properties + tenants at once.
-- One row per batch (tenant_onboarding is the first kind; more to come).

create table if not exists public.batch_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('tenant_onboarding')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  rows_total int not null default 0,
  rows_succeeded int not null default 0,
  rows_failed int not null default 0,
  errors_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_batch_imports_user_created
  on public.batch_imports (user_id, created_at desc);

alter table public.batch_imports enable row level security;

-- Landlords can see their own batches
drop policy if exists "batch_imports_select_own" on public.batch_imports;
create policy "batch_imports_select_own"
  on public.batch_imports for select
  using (auth.uid() = user_id);

-- Landlords can insert batches for themselves
drop policy if exists "batch_imports_insert_own" on public.batch_imports;
create policy "batch_imports_insert_own"
  on public.batch_imports for insert
  with check (auth.uid() = user_id);

-- Landlords can update their own batches (status, counts, errors)
drop policy if exists "batch_imports_update_own" on public.batch_imports;
create policy "batch_imports_update_own"
  on public.batch_imports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Landlords can delete their own batches (history cleanup)
drop policy if exists "batch_imports_delete_own" on public.batch_imports;
create policy "batch_imports_delete_own"
  on public.batch_imports for delete
  using (auth.uid() = user_id);
