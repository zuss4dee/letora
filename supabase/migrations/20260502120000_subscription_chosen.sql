-- Hard plan-selection gate for new signups: a user can't reach /dashboard until
-- they've picked a plan (Starter free or a paid tier with a card on file).
-- Existing users are backfilled so they aren't accidentally redirected back to /onboarding/plan.

alter table public.user_settings
  add column if not exists subscription_chosen_at timestamptz,
  add column if not exists subscription_chosen_plan text;

update public.user_settings
  set subscription_chosen_at = coalesce(subscription_chosen_at, created_at, now())
  where subscription_chosen_at is null;
