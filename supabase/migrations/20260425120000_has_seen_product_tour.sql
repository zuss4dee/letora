-- Product tour (Mercury): one-time guided walkthrough on the dashboard home.

alter table public.user_settings
  add column if not exists has_seen_tour boolean not null default false;

comment on column public.user_settings.has_seen_tour is
  'When false, the Mercury product tour may launch on the dashboard home until completed or skipped.';
