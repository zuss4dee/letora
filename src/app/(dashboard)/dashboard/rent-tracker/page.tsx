import { notFound } from "next/navigation";

import { RentTrackerContent } from "@/components/rent-tracker/rent-tracker-content";
import { getRentPayments } from "@/lib/actions/rent-tracker";
import { computeRentTrackerStats } from "@/lib/rent-tracker-stats";
import { getTenancies } from "@/lib/actions/tenancies";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

export default async function RentTrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  if (!userId) notFound();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [payments, tenancies] = await Promise.all([
    getRentPayments(),
    getTenancies(userId),
  ]);

  const stats = computeRentTrackerStats(payments, todayIso);

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <RentTrackerContent
          payments={payments}
          stats={stats}
          tenancies={tenancies}
          todayIso={todayIso}
        />
      </div>
    </>
  );
}
