-- Optional user-visible label for supplementary / named certificate uploads
alter table public.compliance_records
  add column if not exists document_label text;

comment on column public.compliance_records.document_label is
  'Optional label supplied at upload time (e.g. file name or note for extra documents).';
