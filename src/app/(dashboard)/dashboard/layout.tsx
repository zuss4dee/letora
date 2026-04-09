import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardShellProviders } from "@/components/dashboard/dashboard-shell-providers";
import { MercuryTourGate } from "@/components/dashboard/mercury-tour-gate";
import { ReferencingInboundRealtimeListener } from "@/components/referencing-inbound-realtime-listener";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { redirect } from "next/navigation";

import { getComplianceExpiredSidebarAttention } from "@/lib/actions/compliance";
import { getMaintenanceSafetySidebarAttention } from "@/lib/actions/safety-alerts";
import { getOnboardingStatusForGate, getUserSettings } from "@/lib/actions/user-settings";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import { getAgentRuns } from "@/lib/actions/agents";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;
  const userId = user?.id ?? null;

  const initialAgentRuns = userId ? await getAgentRuns() : [];

  let complianceAttention = false;
  let maintenanceAttention = false;
  let showMercuryTour = false;
  if (userId) {
    const [settings, onboardingGate, cAtt, mAtt] = await Promise.all([
      getUserSettings(userId),
      getOnboardingStatusForGate(userId),
      getComplianceExpiredSidebarAttention(userId),
      getMaintenanceSafetySidebarAttention(userId),
    ]);
    if (!isOnboardingMarkedComplete(onboardingGate)) {
      redirect("/onboarding");
    }
    showMercuryTour = settings ? settings.hasSeenTour !== true : false;
    complianceAttention = cAtt;
    maintenanceAttention = mAtt;
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "220px",
            "--header-height": "4rem",
          } as CSSProperties
        }
      >
        <DashboardShellProviders initialAgentRuns={initialAgentRuns}>
          <AppSidebar
            variant="sidebar"
            userEmail={userEmail}
            complianceAttention={complianceAttention}
            maintenanceAttention={maintenanceAttention}
          />
          <SidebarInset className="bg-background">
            {userId ? <ReferencingInboundRealtimeListener userId={userId} /> : null}
            <SiteHeader />
            <Suspense fallback={null}>
              <MercuryTourGate initialShowTour={showMercuryTour} />
            </Suspense>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </SidebarInset>
        </DashboardShellProviders>
      </SidebarProvider>
    </TooltipProvider>
  );
}
