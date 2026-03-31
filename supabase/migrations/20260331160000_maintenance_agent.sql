-- Phase 3: Maintenance / Complaints agent — triage + acknowledgement tracking

alter table public.maintenance_requests
  add column if not exists ai_triage_category text;

alter table public.maintenance_requests
  add column if not exists ai_triage_summary text;

alter table public.maintenance_requests
  add column if not exists tenant_acknowledged_at timestamptz;

alter table public.maintenance_requests
  add column if not exists landlord_notified_at timestamptz;

comment on column public.maintenance_requests.ai_triage_category is
  'AI triage: urgent-safety | urgent | routine | low-priority';

alter table public.maintenance_requests
  add column if not exists updated_at timestamptz default now();
