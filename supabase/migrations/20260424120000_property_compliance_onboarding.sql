-- Property gas flag + compliance_records: nullable expiry, status "missing", unique per property+type

-- ---------------------------------------------------------------------------
-- properties: gas supply (drives whether Gas Safety certificate row exists)
-- ---------------------------------------------------------------------------
alter table public.properties
add column if not exists has_gas_supply boolean not null default true;

comment on column public.properties.has_gas_supply is
  'When false, no Gas Safety compliance row is created for the property.';

-- ---------------------------------------------------------------------------
-- compliance_records: allow undated certificates + "missing" status
-- ---------------------------------------------------------------------------
alter table public.compliance_records
alter column expiry_date drop not null;

alter table public.compliance_records drop constraint if exists compliance_records_status_check;

alter table public.compliance_records
add constraint compliance_records_status_check check (
  status in ('valid', 'expiring', 'expired', 'missing')
);

comment on column public.compliance_records.status is
  'valid | expiring | expired | missing (no expiry date set yet)';

comment on column public.compliance_records.expiry_date is
  'Certificate expiry; null when status is missing.';

-- Deduplicate before unique index (keep one row per property+type — newest wins)
delete from public.compliance_records cr
where
  cr.id not in (
    select distinct on (property_id, type) id
    from public.compliance_records
    order by property_id, type, created_at desc nulls last, id desc
  );

-- One row per property per certificate type
create unique index if not exists compliance_records_property_id_type_uidx
on public.compliance_records (property_id, type);

-- Derive status from expiry_date; null expiry => missing
create or replace function public.compliance_records_set_status_from_expiry ()
returns trigger
language plpgsql
as $$
begin
  if new.expiry_date is null then
    new.status := 'missing';
    return new;
  end if;
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
