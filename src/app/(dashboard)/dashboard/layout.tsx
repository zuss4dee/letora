import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardShellProviders } from "@/components/dashboard/dashboard-shell-providers";
import { DashboardShellSettingsGate } from "@/components/dashboard/dashboard-shell-settings-gate";
import { SidebarDynamicProvider } from "@/components/dashboard/sidebar-dynamic-context";
import { DashboardMobileInsetBar } from "@/components/dashboard/dashboard-mobile-inset-bar";
import { SidebarWorkflowMeta } from "@/components/dashboard/sidebar-workflow-meta";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardShellLayout({ children }: { children: ReactNode }) {
  // Auth-only: no slow server actions here (see isolated Suspense loaders below).
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
        className="h-svh overflow-hidden"
        style={
          {
            "--sidebar-width": "220px",
            "--header-height": "3.5rem",
          } as CSSProperties
        }
      >
        <DashboardShellProviders initialAgentRuns={[]}>
          <SidebarDynamicProvider>
            <AppSidebar variant="sidebar" userEmail={userEmail} />
            <Suspense fallback={null}>
              <SidebarWorkflowMeta userId={userId} />
            </Suspense>
            <Suspense fallback={null}>
              <DashboardShellSettingsGate userId={userId} />
            </Suspense>
          </SidebarDynamicProvider>
          <SidebarInset className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-background">
            <DashboardMobileInsetBar />
            <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </SidebarInset>
        </DashboardShellProviders>
      </SidebarProvider>
    </TooltipProvider>
  );
}
