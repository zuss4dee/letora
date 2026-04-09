-- Private storage for compliance certificate PDFs + document path on compliance_records

alter table public.compliance_records
add column if not exists document_url text;

comment on column public.compliance_records.document_url is
  'Path within compliance-vault bucket (property_id/filename.pdf), not a public URL.';

-- Private bucket for landlord-uploaded compliance PDFs
insert into storage.buckets (id, name, public)
values ('compliance-vault', 'compliance-vault', false)
on conflict (id) do nothing;

-- Path shape: {property_id}/{type-slug}.pdf — first folder must be a property owned by auth.uid()
drop policy if exists "compliance_vault_insert_own_property" on storage.objects;
create policy "compliance_vault_insert_own_property"
on storage.objects for insert
with check (
  bucket_id = 'compliance-vault'
  and exists (
    select 1
    from public.properties p
    where
      p.user_id = auth.uid ()
      and p.id::text = (storage.foldername (name)) [1]
  )
);

drop policy if exists "compliance_vault_select_own_property" on storage.objects;
create policy "compliance_vault_select_own_property"
on storage.objects for select
using (
  bucket_id = 'compliance-vault'
  and exists (
    select 1
    from public.properties p
    where
      p.user_id = auth.uid ()
      and p.id::text = (storage.foldername (name)) [1]
  )
);

drop policy if exists "compliance_vault_update_own_property" on storage.objects;
create policy "compliance_vault_update_own_property"
on storage.objects for update
using (
  bucket_id = 'compliance-vault'
  and exists (
    select 1
    from public.properties p
    where
      p.user_id = auth.uid ()
      and p.id::text = (storage.foldername (name)) [1]
  )
)
with check (
  bucket_id = 'compliance-vault'
  and exists (
    select 1
    from public.properties p
    where
      p.user_id = auth.uid ()
      and p.id::text = (storage.foldername (name)) [1]
  )
);

drop policy if exists "compliance_vault_delete_own_property" on storage.objects;
create policy "compliance_vault_delete_own_property"
on storage.objects for delete
using (
  bucket_id = 'compliance-vault'
  and exists (
    select 1
    from public.properties p
    where
      p.user_id = auth.uid ()
      and p.id::text = (storage.foldername (name)) [1]
  )
);
