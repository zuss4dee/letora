-- App and PostgREST expect public.tenants; older migrations created public.tenant_profiles.
-- Align the physical table name so inserts from the dashboard succeed on fresh databases.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL AND to_regclass('public.tenant_profiles') IS NOT NULL THEN
    ALTER TABLE public.tenant_profiles RENAME TO tenants;
  END IF;
END $$;
