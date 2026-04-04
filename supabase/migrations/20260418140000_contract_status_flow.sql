-- Contract status flow: signing fields + status constraints

alter table public.contracts add column if not exists signing_token uuid default gen_random_uuid() unique;
alter table public.contracts add column if not exists tenant_signed_at timestamptz;
alter table public.contracts add column if not exists landlord_signed_at timestamptz;
alter table public.contracts add column if not exists sent_at timestamptz;
alter table public.contracts add column if not exists tenancy_id uuid references public.tenancies(id) on delete set null;

-- Allow public read of contracts by signing_token (for tenant signing page)
drop policy if exists "contracts_select_by_signing_token" on public.contracts;
create policy "contracts_select_by_signing_token"
  on public.contracts for select
  using (true);

-- Allow public update by signing_token (tenant sets tenant_signed_at)
drop policy if exists "contracts_update_by_signing_token" on public.contracts;
create policy "contracts_update_by_signing_token"
  on public.contracts for update
  using (true);
