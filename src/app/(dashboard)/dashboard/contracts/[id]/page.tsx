import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { ContractDetailActions } from "@/components/contracts/contract-detail-actions";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getContractDetail } from "@/lib/actions/contracts";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function statusBadge(status: string | null) {
  const s = (status ?? "draft").toLowerCase();
  if (s === "active") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Active
      </Badge>
    );
  }
  if (s === "draft") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        Draft
      </Badge>
    );
  }
  if (s === "expired") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Expired
      </Badge>
    );
  }
  if (s === "terminated") {
    return (
      <Badge className="border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
        Terminated
      </Badge>
    );
  }
  return <span className="text-muted-foreground">{status ?? "—"}</span>;
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  if (!userId) notFound();

  const contract = await getContractDetail(id);
  if (!contract) notFound();

  return (
    <TooltipProvider>
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
                <div className="flex flex-col gap-3 px-4 lg:px-6">
                  <Link
                    href="/dashboard/contracts"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Contracts
                  </Link>
                  <h1 className="text-base font-semibold tracking-tight">Contract</h1>
                  <p className="text-sm text-muted-foreground">
                    {contract.propertyAddress ?? "Property"} · {contract.tenantName ?? "Tenant"}
                  </p>
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">Contract details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Status:</span>
                        {statusBadge(contract.status)}
                      </div>
                      <p>
                        <span className="text-muted-foreground">Property: </span>
                        {contract.propertyAddress ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Tenant: </span>
                        {contract.tenantName ?? "—"}
                        {contract.tenantEmail ? (
                          <span className="text-muted-foreground"> ({contract.tenantEmail})</span>
                        ) : null}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Type: </span>
                        {contract.contractType ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Start date: </span>
                        {contract.startDate ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">End date: </span>
                        {contract.endDate ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Monthly rent: </span>
                        {gbp.format(contract.monthlyRent)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Deposit: </span>
                        {gbp.format(contract.depositAmount)}
                      </p>
                      {contract.specialClauses?.trim() ? (
                        <div>
                          <p className="text-muted-foreground">Special clauses</p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground">
                            {contract.specialClauses}
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <ContractDetailActions contractId={contract.id} status={contract.status} />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
