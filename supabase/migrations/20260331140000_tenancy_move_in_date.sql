-- Optional move-in date (may differ from tenancy start_date for onboarding / referencing)

alter table public.tenancies
  add column if not exists move_in_date date;
