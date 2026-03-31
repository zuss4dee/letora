-- Initial Letora schema (core landlord tables) + strict RLS

create table if not exists public.properties (
  id uuid primary key,
  user_id uuid references auth.users (id),
  address text,
  postcode text,
  city text,
  property_type text,
  bedrooms int,
  bathrooms int,
  monthly_rent numeric,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.tenant_profiles (
  id uuid primary key,
  user_id uuid references auth.users (id),
  full_name text,
  email text,
  phone text,
  date_of_birth date,
  right_to_rent_status text default 'pending',
  verification_doc_url text,
  created_at timestamptz default now()
);

create table if not exists public.tenancies (
  id uuid primary key,
  property_id uuid references public.properties (id),
  tenant_id uuid references public.tenant_profiles (id),
  start_date date,
  end_date date,
  monthly_rent numeric,
  deposit_amount numeric,
  deposit_protected boolean default false,
  contract_url text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.rent_payments (
  id uuid primary key,
  tenancy_id uuid references public.tenancies (id),
  due_date date,
  amount_due numeric,
  amount_paid numeric,
  paid_on date,
  status text default 'pending',
  payment_method text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.maintenance_requests (
  id uuid primary key,
  tenancy_id uuid references public.tenancies (id),
  reported_by_tenant boolean default false,
  description text,
  category text,
  priority text default 'standard',
  status text default 'open',
  contractor_name text,
  contractor_email text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key,
  user_id uuid references auth.users (id),
  property_id uuid references public.properties (id),
  name text,
  email text,
  phone text,
  source text,
  budget numeric,
  move_in_date date,
  qualified_status text default 'new',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.agent_activity_log (
  id uuid primary key,
  user_id uuid references auth.users (id),
  agent_name text,
  action_taken text,
  input_summary text,
  output_summary text,
  status text default 'success',
  requires_approval boolean default false,
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table public.properties enable row level security;
alter table public.tenant_profiles enable row level security;
alter table public.tenancies enable row level security;
alter table public.rent_payments enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.leads enable row level security;
alter table public.agent_activity_log enable row level security;

-- properties (direct ownership via user_id)
drop policy if exists "properties_select_own" on public.properties;
create policy "properties_select_own"
on public.properties for select
using (user_id = auth.uid());

drop policy if exists "properties_insert_own" on public.properties;
create policy "properties_insert_own"
on public.properties for insert
with check (user_id = auth.uid());

drop policy if exists "properties_update_own" on public.properties;
create policy "properties_update_own"
on public.properties for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "properties_delete_own" on public.properties;
create policy "properties_delete_own"
on public.properties for delete
using (user_id = auth.uid());

-- tenant_profiles (direct ownership via user_id)
drop policy if exists "tenant_profiles_select_own" on public.tenant_profiles;
create policy "tenant_profiles_select_own"
on public.tenant_profiles for select
using (user_id = auth.uid());

drop policy if exists "tenant_profiles_insert_own" on public.tenant_profiles;
create policy "tenant_profiles_insert_own"
on public.tenant_profiles for insert
with check (user_id = auth.uid());

drop policy if exists "tenant_profiles_update_own" on public.tenant_profiles;
create policy "tenant_profiles_update_own"
on public.tenant_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "tenant_profiles_delete_own" on public.tenant_profiles;
create policy "tenant_profiles_delete_own"
on public.tenant_profiles for delete
using (user_id = auth.uid());

-- leads (direct ownership via user_id)
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own"
on public.leads for select
using (user_id = auth.uid());

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own"
on public.leads for insert
with check (user_id = auth.uid());

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own"
on public.leads for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own"
on public.leads for delete
using (user_id = auth.uid());

-- agent_activity_log (direct ownership via user_id)
drop policy if exists "agent_activity_log_select_own" on public.agent_activity_log;
create policy "agent_activity_log_select_own"
on public.agent_activity_log for select
using (user_id = auth.uid());

drop policy if exists "agent_activity_log_insert_own" on public.agent_activity_log;
create policy "agent_activity_log_insert_own"
on public.agent_activity_log for insert
with check (user_id = auth.uid());

drop policy if exists "agent_activity_log_update_own" on public.agent_activity_log;
create policy "agent_activity_log_update_own"
on public.agent_activity_log for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "agent_activity_log_delete_own" on public.agent_activity_log;
create policy "agent_activity_log_delete_own"
on public.agent_activity_log for delete
using (user_id = auth.uid());

-- tenancies (ownership via property -> properties.user_id)
drop policy if exists "tenancies_select_own" on public.tenancies;
create policy "tenancies_select_own"
on public.tenancies for select
using (
  exists (
    select 1
    from public.properties p
    where p.id = tenancies.property_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "tenancies_insert_own" on public.tenancies;
create policy "tenancies_insert_own"
on public.tenancies for insert
with check (
  exists (
    select 1
    from public.properties p
    where p.id = tenancies.property_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tenant_profiles t
    where t.id = tenancies.tenant_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "tenancies_update_own" on public.tenancies;
create policy "tenancies_update_own"
on public.tenancies for update
using (
  exists (
    select 1
    from public.properties p
    where p.id = tenancies.property_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.properties p
    where p.id = tenancies.property_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tenant_profiles t
    where t.id = tenancies.tenant_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "tenancies_delete_own" on public.tenancies;
create policy "tenancies_delete_own"
on public.tenancies for delete
using (
  exists (
    select 1
    from public.properties p
    where p.id = tenancies.property_id
      and p.user_id = auth.uid()
  )
);

-- If `rent_payments` already existed from another migration (e.g. rent-tracker) without
-- `tenancy_id`, add it so the tenancy-scoped policies below are valid.
alter table public.rent_payments
  add column if not exists tenancy_id uuid references public.tenancies (id);

-- rent_payments (ownership via tenancy -> property -> properties.user_id)
drop policy if exists "rent_payments_select_own" on public.rent_payments;
create policy "rent_payments_select_own"
on public.rent_payments for select
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = rent_payments.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "rent_payments_insert_own" on public.rent_payments;
create policy "rent_payments_insert_own"
on public.rent_payments for insert
with check (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = rent_payments.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "rent_payments_update_own" on public.rent_payments;
create policy "rent_payments_update_own"
on public.rent_payments for update
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = rent_payments.tenancy_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = rent_payments.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "rent_payments_delete_own" on public.rent_payments;
create policy "rent_payments_delete_own"
on public.rent_payments for delete
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = rent_payments.tenancy_id
      and p.user_id = auth.uid()
  )
);

alter table public.maintenance_requests
  add column if not exists tenancy_id uuid references public.tenancies (id);

-- maintenance_requests (ownership via tenancy -> property -> properties.user_id)
drop policy if exists "maintenance_requests_select_own" on public.maintenance_requests;
create policy "maintenance_requests_select_own"
on public.maintenance_requests for select
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = maintenance_requests.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "maintenance_requests_insert_own" on public.maintenance_requests;
create policy "maintenance_requests_insert_own"
on public.maintenance_requests for insert
with check (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = maintenance_requests.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "maintenance_requests_update_own" on public.maintenance_requests;
create policy "maintenance_requests_update_own"
on public.maintenance_requests for update
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = maintenance_requests.tenancy_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = maintenance_requests.tenancy_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "maintenance_requests_delete_own" on public.maintenance_requests;
create policy "maintenance_requests_delete_own"
on public.maintenance_requests for delete
using (
  exists (
    select 1
    from public.tenancies tn
    join public.properties p on p.id = tn.property_id
    where tn.id = maintenance_requests.tenancy_id
      and p.user_id = auth.uid()
  )
);

