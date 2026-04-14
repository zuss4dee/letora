-- Dashboard checklist: user can dismiss the "finish setup" prompt without completing items.

alter table public.user_settings
  add column if not exists onboarding_setup_reminder_dismissed_at timestamptz;

comment on column public.user_settings.onboarding_setup_reminder_dismissed_at is
  'When set, hides the workspace setup checklist on the dashboard. Cleared when the user skips onboarding so the reminder returns.';
