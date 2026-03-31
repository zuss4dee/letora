-- Leads module: align with app schema (full_name, status, updated_at, qualified_status default)

alter table public.leads add column if not exists full_name text;
alter table public.leads add column if not exists status text;
alter table public.leads add column if not exists updated_at timestamptz not null default now();

-- Backfill status for existing rows
update public.leads set status = coalesce(status, 'new') where status is null;
alter table public.leads alter column status set default 'new';
alter table public.leads alter column status set not null;

-- full_name from legacy name when missing
update public.leads set full_name = coalesce(nullif(trim(full_name), ''), nullif(trim(name), '')) where full_name is null or trim(full_name) = '';

-- Pipeline qualified_status: pending | qualified | disqualified
alter table public.leads alter column qualified_status set default 'pending';
update public.leads
set qualified_status = 'pending'
where qualified_status is null
   or lower(trim(qualified_status)) in ('new', '');
