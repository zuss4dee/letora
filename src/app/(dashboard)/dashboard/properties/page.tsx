export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { getPropertiesPortfolio } from "@/lib/actions/properties";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/server";

import { loadPropertyInspectorActivityByPropertyId } from "./property-inspector-activity";
import { loadPropertyInspectorComplianceByPropertyId } from "./property-inspector-compliance";

async function PropertiesPortfolioContent({
  userId,
  initialSelectedPropertyId,
}: {
  userId: string;
  initialSelectedPropertyId: string | null;
}) {
  const rows = await withTimeout(getPropertiesPortfolio(userId), 3000, [], "properties:getPropertiesPortfolio");
  const ids = rows.map((r) => r.id);
  const [activityByPropertyId, complianceByPropertyId] = await Promise.all([
    loadPropertyInspectorActivityByPropertyId(ids),
    loadPropertyInspectorComplianceByPropertyId(ids),
  ]);
  return (
    <ManagedPropertiesRegistry
      rows={rows}
      activityByPropertyId={activityByPropertyId}
      complianceByPropertyId={complianceByPropertyId}
      initialSelectedPropertyId={initialSelectedPropertyId}
    />
  );
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const raw = sp.propertyId;
  const initialSelectedPropertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B]">
      <Suspense fallback={<div className="p-6 text-sm text-zinc-400">Loading properties…</div>}>
        <PropertiesPortfolioContent
          userId={user.id}
          initialSelectedPropertyId={initialSelectedPropertyId}
        />
      </Suspense>
    </div>
  );
}
