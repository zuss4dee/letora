-- 3-step landlord onboarding wizard: persisted step + landlord segment.

alter table public.user_settings
  add column if not exists onboarding_step integer default 1
    check (onboarding_step is null or (onboarding_step >= 1 and onboarding_step <= 3));

alter table public.user_settings
  add column if not exists landlord_type text;

alter table public.user_settings
  drop constraint if exists user_settings_landlord_type_check;

alter table public.user_settings
  add constraint user_settings_landlord_type_check
  check (
    landlord_type is null
    or landlord_type in ('self_managed', 'portfolio', 'agent', 'new_landlord')
  );

update public.user_settings
set onboarding_step = 1
where onboarding_step is null;

comment on column public.user_settings.onboarding_step is
  'Current onboarding wizard step (1–3).';

comment on column public.user_settings.landlord_type is
  'Landlord segment from onboarding step 2.';
