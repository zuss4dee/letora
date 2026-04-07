import { TenanciesRegistry } from "@/components/tenancies/tenancies-registry";
import {
  autoGeneratePendingPayments,
  getTenancies,
  getThisMonthPayments,
} from "@/lib/actions/tenancies";
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

export default async function TenanciesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  if (userId) {
    await autoGeneratePendingPayments(userId);
  }

  const [properties, tenants, tenancies, payments] = userId
    ? await Promise.all([
        getProperties(userId),
        getTenants(userId),
        getTenancies(userId),
        getThisMonthPayments(userId),
      ])
    : [[], [], [], []];

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: p.address ?? "Property",
  }));

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label: `${t.fullName ?? "Tenant"}${t.email ? ` (${t.email})` : ""}`,
  }));

  return (
    <div className="@container/main flex flex-1 flex-col">
      <TenanciesRegistry
        tenancies={tenancies}
        paymentsThisMonth={payments}
        userId={userId}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
      />
    </div>
  );
}
