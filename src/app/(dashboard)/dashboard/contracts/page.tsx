export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { ContractsRegistry } from "@/components/contracts/contracts-registry";
import { getContracts } from "@/lib/actions/contracts";
import { getPropertyPickList } from "@/lib/actions/properties";
import { getTenantProfilesForContracts } from "@/lib/actions/tenants";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  if (!userId) notFound();

  const [contracts, properties, tenants] = await Promise.all([
    getContracts(),
    getPropertyPickList(),
    getTenantProfilesForContracts(),
  ]);

  return (
    <>
      <DashboardPollRefresh />
      <ContractsRegistry contracts={contracts} properties={properties} tenants={tenants} />
    </>
  );
}
