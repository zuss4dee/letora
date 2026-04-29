-- Extend onboarding pipeline: settings step + tenant step before completed.

alter table public.user_settings
  drop constraint if exists user_settings_onboarding_status_check;

alter table public.user_settings
  add constraint user_settings_onboarding_status_check
  check (onboarding_status in (
    'profile_pending',
    'settings_pending',
    'property_pending',
    'tenant_pending',
    'completed'
  ));

comment on column public.user_settings.onboarding_status is
  'profile_pending → identity; settings_pending → landlord/agency details; property_pending → first property; tenant_pending → first tenant; completed → full app.';
