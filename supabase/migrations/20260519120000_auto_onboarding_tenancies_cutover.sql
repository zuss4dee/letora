-- Cutover: move auto-onboarding from public.tenants to public.tenancies.
-- Safe if 20260518120000 was already applied with the old tenants trigger (migration files are not re-run).

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
DROP TRIGGER IF EXISTS on_tenancy_created ON public.tenancies;

CREATE OR REPLACE FUNCTION public.trigger_auto_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  base_url text;
  sr_key text;
  req bigint;
  landlord_user_id uuid;
BEGIN
  base_url := nullif(trim(both from coalesce(current_setting('app.supabase_url', true), '')), '');
  sr_key := nullif(trim(both from coalesce(current_setting('app.service_role_key', true), '')), '');

  IF base_url IS NULL OR sr_key IS NULL THEN
    RAISE WARNING 'trigger_auto_onboarding: app.supabase_url or app.service_role_key not set; skipping HTTP call';
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO landlord_user_id
  FROM public.properties p
  WHERE p.id = NEW.property_id
  LIMIT 1;

  base_url := rtrim(base_url, '/');

  SELECT net.http_post(
    url := base_url || '/functions/v1/auto-onboard-tenant',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sr_key
    ),
    body := jsonb_build_object(
      'tenancy_id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'property_id', NEW.property_id,
      'landlord_id', landlord_user_id,
      'rent_amount', NEW.monthly_rent,
      'move_in_date', NEW.move_in_date
    )
  )
  INTO req;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenancy_created
  AFTER INSERT ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_onboarding();
