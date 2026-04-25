export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { getPropertiesPortfolio } from "@/lib/actions/properties";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/server";

async function PropertiesPortfolioBoundary({ userId }: { userId: string }) {
  const rows = await withTimeout(getPropertiesPortfolio(userId), 3000, [], "properties:getPropertiesPortfolio");
  return <ManagedPropertiesRegistry rows={rows} />;
}

export default async function PropertiesPage() {
  const supabase = await withTimeout(createClient(), 3000, null, "properties:createClient");
  if (!supabase) return <div className="p-6 text-sm text-zinc-100">Properties page works</div>;

  const auth = await withTimeout(
    supabase.auth.getUser(),
    3000,
    { data: { user: null }, error: null },
    "properties:supabase.auth.getUser",
  );
  const userId = auth.data.user?.id ?? null;
  if (!userId) return <div className="p-6 text-sm text-zinc-100">Properties page works</div>;

  // Portfolio data is isolated so slow queries cannot stall page shell render.
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-100">Loading properties...</div>}>
      <PropertiesPortfolioBoundary userId={userId} />
    </Suspense>
  );
}
