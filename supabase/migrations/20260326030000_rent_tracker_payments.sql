-- Rent Tracker payments table (create if missing) and compatibility columns.
create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  property_id uuid references public.properties (id),
  tenant_id uuid references public.tenant_profiles (id),
  amount numeric,
  due_date date,
  paid_date date,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- Ensure requested columns exist even if the table already existed.
alter table public.rent_payments add column if not exists user_id uuid references auth.users (id);
alter table public.rent_payments add column if not exists property_id uuid references public.properties (id);
alter table public.rent_payments add column if not exists tenant_id uuid references public.tenant_profiles (id);
alter table public.rent_payments add column if not exists amount numeric;
alter table public.rent_payments add column if not exists due_date date;
alter table public.rent_payments add column if not exists paid_date date;
alter table public.rent_payments add column if not exists status text default 'pending';
alter table public.rent_payments add column if not exists notes text;
alter table public.rent_payments add column if not exists created_at timestamptz default now();

alter table public.rent_payments enable row level security;

drop policy if exists "rent_payments_select_own" on public.rent_payments;
create policy "rent_payments_select_own"
on public.rent_payments for select
using (user_id = auth.uid());

drop policy if exists "rent_payments_insert_own" on public.rent_payments;
create policy "rent_payments_insert_own"
on public.rent_payments for insert
with check (user_id = auth.uid());

drop policy if exists "rent_payments_update_own" on public.rent_payments;
create policy "rent_payments_update_own"
on public.rent_payments for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "rent_payments_delete_own" on public.rent_payments;
create policy "rent_payments_delete_own"
on public.rent_payments for delete
using (user_id = auth.uid());
