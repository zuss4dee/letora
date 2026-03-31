-- Contracts (tenancy agreements) owned by the landlord user

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenant_profiles (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  contract_type text not null,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric not null,
  deposit_amount numeric not null,
  special_clauses text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_user_created_idx
  on public.contracts (user_id, created_at desc);

create index if not exists contracts_user_status_idx
  on public.contracts (user_id, status);

alter table public.contracts enable row level security;

drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own"
  on public.contracts for select
  using (user_id = auth.uid());

drop policy if exists "contracts_insert_own" on public.contracts;
create policy "contracts_insert_own"
  on public.contracts for insert
  with check (user_id = auth.uid());

drop policy if exists "contracts_update_own" on public.contracts;
create policy "contracts_update_own"
  on public.contracts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "contracts_delete_own" on public.contracts;
create policy "contracts_delete_own"
  on public.contracts for delete
  using (user_id = auth.uid());
