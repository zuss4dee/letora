import { TenantRegistry } from "@/components/tenants/tenant-registry";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

export default async function TenantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const tenants = userId ? await getTenants(userId) : [];

  return <TenantRegistry tenants={tenants} />;
}
