-- Persist Stripe subscription trial end for billing UI (sidebar + billing page).
alter table public.user_settings
  add column if not exists subscription_trial_end timestamptz;

comment on column public.user_settings.subscription_trial_end is
  'When the Stripe subscription trial ends (from subscription.trial_end). Null if not trialing or no trial.';
