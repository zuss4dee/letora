import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { RentTrackerContent } from "@/components/rent-tracker/rent-tracker-content";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  const userEmail = user?.email ?? null;

  if (!userId) notFound();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [payments, tenancies] = await Promise.all([
    getRentPayments(),
    getTenancies(userId),
  ]);

  const stats = computeRentTrackerStats(payments, todayIso);

  return (
    <TooltipProvider>
      <DashboardPollRefresh />
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" userEmail={userEmail} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <RentTrackerContent
                payments={payments}
                stats={stats}
                tenancies={tenancies}
                todayIso={todayIso}
              />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
