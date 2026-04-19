-- Ensure row id defaults gen_random_uuid() on reset and on already-migrated DBs.
-- tenant_profiles / tenants; tenancies id.

DO $$
BEGIN
  IF to_regclass('public.tenant_profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tenant_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  END IF;
  IF to_regclass('public.tenants') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tenants ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  END IF;
  IF to_regclass('public.tenancies') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tenancies ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  END IF;
END $$;
