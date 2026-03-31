import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { AddContractDialog } from "@/components/contracts/add-contract-dialog";
import { ContractsTable } from "@/components/contracts/contracts-table";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getContracts, type ContractListRow } from "@/lib/actions/contracts";
import { getPropertyPickList } from "@/lib/actions/properties";
import { getTenantProfilesForContracts } from "@/lib/actions/tenants";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

function computeContractStats(contracts: ContractListRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  const limitIso = limit.toISOString().slice(0, 10);

  let active = 0;
  let draft = 0;
  let expiringSoon = 0;

  for (const c of contracts) {
    const st = (c.status ?? "").toLowerCase();
    if (st === "active") active++;
    if (st === "draft") draft++;
    if (
      st === "active" &&
      c.endDate &&
      c.endDate >= today &&
      c.endDate <= limitIso
    ) {
      expiringSoon++;
    }
  }

  return {
    total: contracts.length,
    active,
    draft,
    expiringSoon,
  };
}

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  if (!userId) notFound();

  const [contracts, properties, tenants] = await Promise.all([
    getContracts(),
    getPropertyPickList(),
    getTenantProfilesForContracts(),
  ]);

  const stats = computeContractStats(contracts);

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
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Contracts</h1>
                    <p className="text-sm text-muted-foreground">
                      Manage tenancy agreements and contracts.
                    </p>
                  </div>
                  <AddContractDialog properties={properties} tenants={tenants} />
                </div>

                <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total contracts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.total}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.active}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.draft}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Expiring soon
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.expiringSoon}</div>
                      <p className="text-xs text-muted-foreground">Active, ending within 30 days</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>All contracts</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ContractsTable contracts={contracts} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
