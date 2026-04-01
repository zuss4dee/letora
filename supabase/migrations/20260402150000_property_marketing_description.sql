-- CEO listing generation: persist generated marketing copy on properties

alter table public.properties
  add column if not exists marketing_description text;

