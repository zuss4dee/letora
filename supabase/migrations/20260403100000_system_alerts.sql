-- System-level alerts for model/provider failures and operational incidents.

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  message text not null,
  error_details jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists system_alerts_resolved_created_idx
  on public.system_alerts (resolved, created_at desc);
