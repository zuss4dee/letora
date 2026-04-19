-- PostgREST can only embed `tenancies` under `tenants` when `tenancies.tenant_id`
-- references `public.tenants(id)`. If `public.tenants` was created separately while
-- `tenancies` still pointed at `tenant_profiles`, embedding fails with PGRST200.

DO $$
BEGIN
  IF to_regclass('public.tenancies') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    NULL;
  ELSE
    ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_tenant_id_fkey;
    ALTER TABLE public.tenancies
      ADD CONSTRAINT tenancies_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
END $$;
