create table if not exists public.contract_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  filename text not null,
  storage_path text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.contract_templates enable row level security;

create policy "Users manage own templates"
on public.contract_templates
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Supabase storage setup instructions:
-- 1) Create bucket: contract-templates
--    insert into storage.buckets (id, name, public) values ('contract-templates', 'contract-templates', false);
-- 2) Add RLS policies on storage.objects allowing users to manage files under their own folder prefix:
--    bucket_id = 'contract-templates' and auth.uid()::text = (storage.foldername(name))[1]

