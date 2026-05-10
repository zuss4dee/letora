import { Suspense } from "react";

import { WorkspaceBillingView } from "@/components/billing/workspace-billing-view";
import type { WorkspaceOperationalStats } from "@/components/billing/workspace-billing-view";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function BillingAsyncSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;

  let operationalStats: WorkspaceOperationalStats = { propertyCount: 0, tenancyCount: null };

  if (user?.id) {
    const [{ count: propertyCount }, tenancyRes] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("tenancies")
        .select("id, properties!inner(user_id)", { count: "exact", head: true })
        .eq("properties.user_id", user.id),
    ]);

    operationalStats = {
      propertyCount: propertyCount ?? 0,
      tenancyCount: tenancyRes.error ? null : tenancyRes.count ?? 0,
    };

    if (tenancyRes.error && process.env.NODE_ENV === "development") {
      console.warn("[billing] tenancy count embed failed:", tenancyRes.error.message);
    }
  }

  return <WorkspaceBillingView settings={existing} operationalStats={operationalStats} />;
}

export default async function BillingPage() {
  return (
    <div className="@container/main relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#0b0b0b] dark:text-zinc-100">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-0 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl py-12">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-[2px] bg-zinc-200 dark:bg-zinc-900" />}>
              <BillingAsyncSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
