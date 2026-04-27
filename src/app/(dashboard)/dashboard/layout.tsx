import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardShellProviders } from "@/components/dashboard/dashboard-shell-providers";
import { OnboardingGateBoundary } from "@/components/dashboard/onboarding-gate-boundary";
import { SidebarApprovalsMeta } from "@/components/dashboard/sidebar-approvals-meta";
import { SidebarAttentionBadges } from "@/components/dashboard/sidebar-attention-badges";
import { SidebarDynamicProvider } from "@/components/dashboard/sidebar-dynamic-context";
import { DashboardMobileInsetBar } from "@/components/dashboard/dashboard-mobile-inset-bar";
import { SidebarSubscriptionMeta } from "@/components/dashboard/sidebar-subscription-meta";
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
        style={
          {
            "--sidebar-width": "220px",
            "--header-height": "4rem",
          } as CSSProperties
        }
      >
        <DashboardShellProviders initialAgentRuns={[]}>
          <SidebarDynamicProvider>
            <AppSidebar variant="sidebar" userEmail={userEmail} />
            <Suspense fallback={null}>
              <SidebarAttentionBadges userId={userId} />
            </Suspense>
            <Suspense fallback={null}>
              <SidebarSubscriptionMeta userId={userId} />
            </Suspense>
            <Suspense fallback={null}>
              <SidebarApprovalsMeta />
            </Suspense>
          </SidebarDynamicProvider>
          <SidebarInset className="bg-background">
            <DashboardMobileInsetBar />
            <Suspense fallback={null}>
              <OnboardingGateBoundary userId={userId} />
            </Suspense>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </SidebarInset>
        </DashboardShellProviders>
      </SidebarProvider>
    </TooltipProvider>
  );
}
