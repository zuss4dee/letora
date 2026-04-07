import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardShellProviders } from "@/components/dashboard/dashboard-shell-providers";
import { ReferencingInboundRealtimeListener } from "@/components/referencing-inbound-realtime-listener";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
          <AppSidebar variant="sidebar" userEmail={userEmail} />
          <SidebarInset className="bg-[#0E0E0E]">
            {userId ? <ReferencingInboundRealtimeListener userId={userId} /> : null}
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </SidebarInset>
        </DashboardShellProviders>
      </SidebarProvider>
    </TooltipProvider>
  );
}
