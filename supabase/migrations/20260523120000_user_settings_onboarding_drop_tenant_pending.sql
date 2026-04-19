-- Landlord wizard no longer has a separate tenant step. Normalize legacy rows and drop
-- `tenant_pending` from the CHECK so it cannot be written again.

UPDATE public.user_settings
SET onboarding_status = 'property_pending', updated_at = now()
WHERE onboarding_status = 'tenant_pending';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_onboarding_status_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_onboarding_status_check
  CHECK (onboarding_status IN (
    'profile_pending',
    'settings_pending',
    'property_pending',
    'completed'
  ));

COMMENT ON COLUMN public.user_settings.onboarding_status IS
  'profile_pending → identity; settings_pending → landlord/agency details; property_pending → first property; completed → full app.';
