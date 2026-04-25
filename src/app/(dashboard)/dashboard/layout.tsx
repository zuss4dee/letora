import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardSidebarBoundary } from "@/components/dashboard/dashboard-sidebar-boundary";
import { DashboardShellProviders } from "@/components/dashboard/dashboard-shell-providers";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardShellLayout({ children }: { children: ReactNode }) {
  // Permanent safe layout: auth-only logic here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;
  const userEmail = user.email ?? null;

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
        <DashboardShellProviders initialAgentRuns={[]}>
          <Suspense fallback={<AppSidebar variant="sidebar" userEmail={userEmail} pendingApprovalsCount={0} />}>
            <DashboardSidebarBoundary userId={userId} userEmail={userEmail} />
          </Suspense>
          <SidebarInset className="bg-background">
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </SidebarInset>
        </DashboardShellProviders>
      </SidebarProvider>
    </TooltipProvider>
  );
}
