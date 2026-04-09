-- Replace boolean gate with explicit onboarding pipeline status.

alter table public.user_settings
  add column if not exists onboarding_status text;

do $m$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'onboarding_completed'
  ) then
    execute $q$
      update public.user_settings
      set onboarding_status = case
        when onboarding_completed is true then 'completed'
        else 'profile_pending'
      end
      where onboarding_status is null
    $q$;
  else
    update public.user_settings
    set onboarding_status = 'profile_pending'
    where onboarding_status is null;
  end if;
end
$m$;

update public.user_settings
set onboarding_status = 'profile_pending'
where onboarding_status is null;

alter table public.user_settings
  alter column onboarding_status set default 'profile_pending';

alter table public.user_settings
  alter column onboarding_status set not null;

alter table public.user_settings
  drop column if exists onboarding_completed;

alter table public.user_settings
  drop constraint if exists user_settings_onboarding_status_check;

alter table public.user_settings
  add constraint user_settings_onboarding_status_check
  check (onboarding_status in ('profile_pending', 'property_pending', 'completed'));

comment on column public.user_settings.onboarding_status is
  'profile_pending → identity/focus; property_pending → add first property; completed → full app.';
