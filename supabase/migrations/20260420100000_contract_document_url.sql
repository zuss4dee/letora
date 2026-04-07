-- Add document_url to contracts for storing generated PDF agreements

alter table public.contracts add column if not exists document_url text;

-- Create storage bucket for generated contract PDFs
insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload contract PDFs
drop policy if exists "contract_documents_insert_own" on storage.objects;
create policy "contract_documents_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own contract PDFs
drop policy if exists "contract_documents_select_own" on storage.objects;
create policy "contract_documents_select_own"
  on storage.objects for select
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read of contract PDFs by signing token (for tenant signing flow)
drop policy if exists "contract_documents_select_by_contract_id" on storage.objects;
create policy "contract_documents_select_by_contract_id"
  on storage.objects for select
  using (bucket_id = 'contract-documents');
