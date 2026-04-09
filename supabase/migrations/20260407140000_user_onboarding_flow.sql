-- Onboarding gate: new users complete /onboarding before the dashboard shell.

alter table public.user_settings
  add column if not exists onboarding_completed boolean not null default false;

alter table public.user_settings
  add column if not exists onboarding_primary_goal text;

-- Existing workspaces skip the wizard.
update public.user_settings
set onboarding_completed = true
where onboarding_completed is distinct from true;

comment on column public.user_settings.onboarding_completed is 'When false, dashboard redirects to /onboarding until checkout success completes the flow.';
comment on column public.user_settings.onboarding_primary_goal is 'User-selected focus during onboarding: automate_rent | stay_compliant | find_leads';
