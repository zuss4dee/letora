import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";

export default async function AgentsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

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
        <AppSidebar variant="sidebar" userEmail={userEmail} />
        <SidebarInset className="bg-[#0E0E0E]">
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
