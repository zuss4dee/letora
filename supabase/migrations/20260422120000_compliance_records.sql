-- Property compliance certificates (EPC, gas, electrical) — linked to properties with RLS.

-- Status rules (enforced on insert/update via trigger):
--   expired   : expiry_date < current_date
--   expiring  : expiry_date >= current_date and within the next 30 days (inclusive)
--   valid     : expiry_date more than 30 days after current_date

create table if not exists public.compliance_records (
  id uuid primary key default gen_random_uuid (),
  property_id uuid not null references public.properties (id) on delete cascade,
  type text not null,
  expiry_date date not null,
  status text not null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint compliance_records_type_check check (
    type in ('EPC', 'Gas Safety', 'Electric Safety')
  ),
  constraint compliance_records_status_check check (
    status in ('valid', 'expiring', 'expired')
  )
);

create index if not exists compliance_records_property_id_idx on public.compliance_records (property_id);

create index if not exists compliance_records_expiry_date_idx on public.compliance_records (expiry_date);

comment on table public.compliance_records is
  'Landlord compliance certificates per property; status derived from expiry_date.';

comment on column public.compliance_records.type is
  'EPC | Gas Safety | Electric Safety';

comment on column public.compliance_records.status is
  'valid | expiring (within 30 days) | expired';

-- Keep updated_at fresh
create or replace function public.compliance_records_set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists compliance_records_set_updated_at on public.compliance_records;

create trigger compliance_records_set_updated_at
before update on public.compliance_records
for each row
execute function public.compliance_records_set_updated_at ();

-- Derive status from expiry_date (server current_date; align app timezone in UI if needed)
create or replace function public.compliance_records_set_status_from_expiry ()
returns trigger
language plpgsql
as $$
begin
  if new.expiry_date < current_date then
    new.status := 'expired';
  elsif new.expiry_date <= current_date + 30 then
    new.status := 'expiring';
  else
    new.status := 'valid';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_records_set_status on public.compliance_records;

create trigger compliance_records_set_status
before insert
or
update of expiry_date on public.compliance_records for each row
execute function public.compliance_records_set_status_from_expiry ();

alter table public.compliance_records enable row level security;

drop policy if exists "compliance_records_select_own" on public.compliance_records;

create policy "compliance_records_select_own" on public.compliance_records for select using (
  exists (
    select 1
    from public.properties p
    where
      p.id = compliance_records.property_id
      and p.user_id = auth.uid ()
  )
);

drop policy if exists "compliance_records_insert_own" on public.compliance_records;

create policy "compliance_records_insert_own" on public.compliance_records for insert
with check (
  exists (
    select 1
    from public.properties p
    where
      p.id = compliance_records.property_id
      and p.user_id = auth.uid ()
  )
);

drop policy if exists "compliance_records_update_own" on public.compliance_records;

create policy "compliance_records_update_own" on public.compliance_records for update using (
  exists (
    select 1
    from public.properties p
    where
      p.id = compliance_records.property_id
      and p.user_id = auth.uid ()
  )
)
with check (
  exists (
    select 1
    from public.properties p
    where
      p.id = compliance_records.property_id
      and p.user_id = auth.uid ()
  )
);

drop policy if exists "compliance_records_delete_own" on public.compliance_records;

create policy "compliance_records_delete_own" on public.compliance_records for delete using (
  exists (
    select 1
    from public.properties p
    where
      p.id = compliance_records.property_id
      and p.user_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- Seed: three sample rows on the earliest-created property (if any).
-- Status is set by trigger from expiry_date only — omit status in INSERT.
-- ---------------------------------------------------------------------------
insert into
  public.compliance_records (property_id, type, expiry_date)
select
  p.id,
  v.type,
  v.expiry_date::date
from
  (
    select
      id
    from
      public.properties
    order by
      created_at nulls last
    limit
      1
  ) p
  cross join (
    values
      ('EPC', current_date + 400),
      ('Gas Safety', current_date + 14),
      ('Electric Safety', current_date - 5)
  ) as v(type, expiry_date)
where
  exists (
    select
      1
    from
      public.properties
    limit
      1
  );
