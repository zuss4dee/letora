export const dynamic = "force-dynamic";

import { MaintenanceRegistry } from "@/components/maintenance/maintenance-registry";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { getTenancies } from "@/lib/actions/tenancies";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  const [requests, tenancies] = userId
    ? await Promise.all([getMaintenanceRequests(userId), getTenancies(userId)])
    : [{ open: [], resolved: [] }, []];

  const tenancyOptions = tenancies.map((t) => ({
    id: t.id,
    label: `${t.propertyAddress ?? "Property"} · ${t.tenantFullName ?? "Tenant"}`,
  }));

  return (
    <>
      <DashboardPollRefresh />
      <MaintenanceRegistry
        open={requests.open}
        resolved={requests.resolved}
        tenancies={tenancyOptions}
      />
    </>
  );
}
