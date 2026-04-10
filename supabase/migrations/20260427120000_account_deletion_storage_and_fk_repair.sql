-- Unblock auth.admin.deleteUser():
-- 1) storage.objects: drop FK(s) to auth.users (e.g. after file uploads).
-- 2) Reapply public ON DELETE CASCADE FKs where those tables/columns exist (skips missing tables — some remotes
--    diverge from full migration history).

BEGIN;

-- ---------------------------------------------------------------------------
-- storage.objects: drop every FK targeting auth.users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'f'
      AND n.nspname = 'storage'
      AND t.relname = 'objects'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE storage.objects DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Public schema: drop / re-add cascades only when tables exist
-- ---------------------------------------------------------------------------
DO $public$
BEGIN
  -- Phase 1: drop (order matches original migration; skip missing tables)
  IF to_regclass('public.rent_payments') IS NOT NULL THEN
    ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_user_id_fkey;
    ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_tenancy_id_fkey;
    ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_property_id_fkey;
    ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_tenant_id_fkey;
  END IF;
  IF to_regclass('public.maintenance_requests') IS NOT NULL THEN
    ALTER TABLE public.maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_tenancy_id_fkey;
  END IF;
  IF to_regclass('public.tenancies') IS NOT NULL THEN
    ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_property_id_fkey;
    ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_tenant_id_fkey;
  END IF;
  IF to_regclass('public.leads') IS NOT NULL THEN
    ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_property_id_fkey;
    ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
  END IF;
  IF to_regclass('public.properties') IS NOT NULL THEN
    ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_user_id_fkey;
  END IF;
  IF to_regclass('public.tenant_profiles') IS NOT NULL THEN
    ALTER TABLE public.tenant_profiles DROP CONSTRAINT IF EXISTS tenant_profiles_user_id_fkey;
  END IF;
  IF to_regclass('public.agent_activity_log') IS NOT NULL THEN
    ALTER TABLE public.agent_activity_log DROP CONSTRAINT IF EXISTS agent_activity_log_user_id_fkey;
  END IF;
  IF to_regclass('public.contract_templates') IS NOT NULL THEN
    ALTER TABLE public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_user_id_fkey;
  END IF;
  IF to_regclass('public.agent_actions') IS NOT NULL THEN
    ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_user_id_fkey;
  END IF;

  -- Phase 2: re-add (dependency order)
  IF to_regclass('public.properties') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenant_profiles') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenant_profiles' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.tenant_profiles
      ADD CONSTRAINT tenant_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.leads') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.agent_activity_log') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'agent_activity_log' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.agent_activity_log
      ADD CONSTRAINT agent_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.contract_templates') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'contract_templates' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.contract_templates
      ADD CONSTRAINT contract_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.agent_actions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'agent_actions' AND column_name = 'user_id'
     ) THEN
    ALTER TABLE public.agent_actions
      ADD CONSTRAINT agent_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.leads') IS NOT NULL
     AND to_regclass('public.properties') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'property_id'
     ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenancies') IS NOT NULL
     AND to_regclass('public.properties') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenancies' AND column_name = 'property_id'
     ) THEN
    ALTER TABLE public.tenancies
      ADD CONSTRAINT tenancies_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.tenancies') IS NOT NULL
     AND to_regclass('public.tenant_profiles') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenancies' AND column_name = 'tenant_id'
     ) THEN
    ALTER TABLE public.tenancies
      ADD CONSTRAINT tenancies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant_profiles (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.maintenance_requests') IS NOT NULL
     AND to_regclass('public.tenancies') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'maintenance_requests' AND column_name = 'tenancy_id'
     ) THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.rent_payments') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.rent_payments
        ADD CONSTRAINT rent_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
    END IF;
    IF to_regclass('public.tenancies') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenancy_id'
       ) THEN
      ALTER TABLE public.rent_payments
        ADD CONSTRAINT rent_payments_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;
    END IF;
    IF to_regclass('public.properties') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'property_id'
       ) THEN
      ALTER TABLE public.rent_payments
        ADD CONSTRAINT rent_payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
    END IF;
    IF to_regclass('public.tenant_profiles') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_id'
       ) THEN
      ALTER TABLE public.rent_payments
        ADD CONSTRAINT rent_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant_profiles (id) ON DELETE CASCADE;
    END IF;
  END IF;
END $public$;

-- ---------------------------------------------------------------------------
-- Email tables
-- ---------------------------------------------------------------------------
DO $email$
BEGIN
  IF to_regclass('public.email_unsubscribes') IS NOT NULL THEN
    ALTER TABLE public.email_unsubscribes DROP CONSTRAINT IF EXISTS email_unsubscribes_user_id_fkey;
    ALTER TABLE public.email_unsubscribes
      ADD CONSTRAINT email_unsubscribes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.email_template_versions') IS NOT NULL THEN
    ALTER TABLE public.email_template_versions DROP CONSTRAINT IF EXISTS email_template_versions_created_by_fkey;
    ALTER TABLE public.email_template_versions
      ADD CONSTRAINT email_template_versions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $email$;

COMMIT;
