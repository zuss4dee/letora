-- email_drafts: AI-generated email drafts visible on /dashboard/emails
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tenancy_id uuid references public.tenancies(id) on delete set null,
  tenant_id uuid references public.tenant_profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'scheduled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists email_drafts_user_created_idx
  on public.email_drafts (user_id, created_at desc);

alter table public.email_drafts enable row level security;

create policy "Users see own email drafts" on public.email_drafts
  for all using (auth.uid() = user_id);
