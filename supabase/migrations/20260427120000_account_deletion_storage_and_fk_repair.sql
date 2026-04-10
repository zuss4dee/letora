-- Unblock auth.admin.deleteUser():
-- 1) storage.objects often still has FK(s) to auth.users (e.g. objects_owner_fkey) — deleting the user fails if they
--    uploaded files. Supabase may reintroduce variants; we drop any FK from storage.objects → auth.users.
-- 2) Idempotently reapply public FK cascades from 20260404120000 + email FKs from 20260426120000 so a partial
--    or missed migration history still leaves the DB in a good state.

BEGIN;

-- ---------------------------------------------------------------------------
-- storage.objects: drop every FK targeting auth.users (do not recreate — allows user delete; rows may retain owner)
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
-- Public schema cascades (same as 20260404120000_account_deletion_fk_cascade.sql)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_user_id_fkey;
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_tenancy_id_fkey;
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_property_id_fkey;
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_tenant_id_fkey;
ALTER TABLE public.maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_tenancy_id_fkey;
ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_property_id_fkey;
ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_tenant_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_property_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_user_id_fkey;
ALTER TABLE public.tenant_profiles DROP CONSTRAINT IF EXISTS tenant_profiles_user_id_fkey;
ALTER TABLE public.agent_activity_log DROP CONSTRAINT IF EXISTS agent_activity_log_user_id_fkey;
ALTER TABLE public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_user_id_fkey;
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_user_id_fkey;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.tenant_profiles
  ADD CONSTRAINT tenant_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.agent_activity_log
  ADD CONSTRAINT agent_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.contract_templates
  ADD CONSTRAINT contract_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;

ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant_profiles (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Email tables (same as 20260426120000_account_deletion_email_fks.sql)
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
