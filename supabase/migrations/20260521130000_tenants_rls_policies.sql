-- Landlord-owned tenant rows: ensure RLS policies exist on public.tenants.
-- Fixes inserts failing with 42501 when tenants was created/renamed without the
-- original tenant_profiles policies attached (or policies were dropped).

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Names from initial_schema (table may have been renamed from tenant_profiles)
DROP POLICY IF EXISTS "tenant_profiles_select_own" ON public.tenants;
DROP POLICY IF EXISTS "tenant_profiles_insert_own" ON public.tenants;
DROP POLICY IF EXISTS "tenant_profiles_update_own" ON public.tenants;
DROP POLICY IF EXISTS "tenant_profiles_delete_own" ON public.tenants;

DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_own" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete_own" ON public.tenants;

CREATE POLICY "tenants_select_own"
  ON public.tenants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "tenants_insert_own"
  ON public.tenants FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tenants_update_own"
  ON public.tenants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tenants_delete_own"
  ON public.tenants FOR DELETE
  USING (user_id = auth.uid());
