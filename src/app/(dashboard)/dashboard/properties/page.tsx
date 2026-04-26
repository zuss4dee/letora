export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { getPropertiesPortfolio } from "@/lib/actions/properties";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/server";

async function PropertiesPortfolioContent({ userId }: { userId: string }) {
  const rows = await withTimeout(getPropertiesPortfolio(userId), 3000, [], "properties:getPropertiesPortfolio");
  return <ManagedPropertiesRegistry rows={rows} />;
}

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B]">
      <Suspense fallback={<div className="p-6 text-sm text-zinc-400">Loading properties…</div>}>
        <PropertiesPortfolioContent userId={user.id} />
      </Suspense>
    </div>
  );
}
