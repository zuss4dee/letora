-- App code uses public.tenants; some databases use that table (rename/evolution from tenant_profiles).
-- A leftover FK named tenant_profiles_user_id_fkey on tenants still pointed at auth.users without CASCADE,
-- blocking auth.admin.deleteUser(). Fix any tenants.user_id → auth.users FK regardless of constraint name.

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = 'tenants'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.tenants DROP CONSTRAINT %I', r.conname);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
