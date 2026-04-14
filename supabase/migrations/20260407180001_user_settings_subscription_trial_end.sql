-- Persist Stripe subscription trial end for billing UI (sidebar + billing page).
-- Note: version must be unique; 20260407140000 is used by user_onboarding_flow.sql.
alter table public.user_settings
  add column if not exists subscription_trial_end timestamptz;

comment on column public.user_settings.subscription_trial_end is
  'When the Stripe subscription trial ends (from subscription.trial_end). Null if not trialing or no trial.';
