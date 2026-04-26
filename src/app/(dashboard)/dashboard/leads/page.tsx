import { Suspense } from "react";
import { notFound } from "next/navigation";

import { LeadsRegistry } from "@/components/leads/leads-registry";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { getLeads } from "@/lib/actions/leads";
import { getPropertyPickList } from "@/lib/actions/properties";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/server";

async function LeadsRegistrySection() {
  const [leads, properties] = await Promise.all([
    withTimeout(getLeads(), 3000, [], "leads:getLeads"),
    withTimeout(getPropertyPickList(), 3000, [], "leads:getPropertyPickList"),
  ]);
  return <LeadsRegistry leads={leads} properties={properties} />;
}

function LeadsRegistryFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#131313] text-[#e5e2e1]">
      <div className="border-b border-[#282828] bg-[#161616] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="h-3 w-24 animate-pulse bg-[#2a2a2a]" />
            <div className="h-6 w-40 animate-pulse bg-[#2a2a2a]" />
          </div>
          <div className="h-8 w-28 animate-pulse bg-[#2a2a2a]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-b border-[#282828] bg-[#282828] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`lead-fallback-stat-${i}`} className="bg-[#161616] px-4 py-3">
            <div className="mb-2 h-2 w-16 animate-pulse bg-[#2a2a2a]" />
            <div className="h-5 w-8 animate-pulse bg-[#2a2a2a]" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[#282828] bg-[#161616] px-4 py-2 sm:px-6">
          <div className="h-6 w-64 animate-pulse bg-[#2a2a2a]" />
          <div className="h-6 w-20 animate-pulse bg-[#2a2a2a]" />
        </div>
        <div className="hidden border-b border-[#282828] bg-[#161616] px-4 py-2 md:grid md:grid-cols-6 md:gap-3 sm:px-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`lead-fallback-header-${i}`} className="h-3 animate-pulse bg-[#2a2a2a]" />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-[#282828]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`lead-fallback-row-${i}`}
              className="grid grid-cols-1 gap-2 bg-[#131313] px-4 py-3 md:grid-cols-6 sm:px-6"
            >
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={`lead-fallback-cell-${i}-${j}`} className="h-3 animate-pulse bg-[#2a2a2a]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col">
        <Suspense fallback={<LeadsRegistryFallback />}>
          <LeadsRegistrySection />
        </Suspense>
      </div>
    </>
  );
}
