-- Base landlord settings table (must exist before 20260328120000_agent_memory_and_steps alters it)

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  business_name text,
  landlord_name text,
  contact_phone text,
  contact_email text,
  business_address text,
  rent_chaser_tone text default 'professional',
  first_chase_days integer default 3,
  email_signoff text,
  include_payment_plan boolean default true,
  rent_chaser_instructions text,
  min_lead_score integer default 70,
  preferred_sources text[],
  disqualify_no_movein boolean default false,
  lead_qualifier_criteria text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
