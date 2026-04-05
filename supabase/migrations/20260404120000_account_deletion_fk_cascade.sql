BEGIN;

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
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_user_id_fkey;
ALTER TABLE public.agent_activity_log DROP CONSTRAINT IF EXISTS agent_activity_log_user_id_fkey;
ALTER TABLE public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_user_id_fkey;
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_user_id_fkey;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
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
  ADD CONSTRAINT tenancies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;

ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_tenancy_id_fkey FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE CASCADE;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;

COMMIT;
