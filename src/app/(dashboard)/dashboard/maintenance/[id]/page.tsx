import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssignContractorForm } from "@/components/maintenance/assign-contractor-form";
import { MaintenanceRelatedEmailsTable } from "@/components/maintenance/related-emails-table";
import { ResolveMaintenanceForm } from "@/components/maintenance/resolve-maintenance-form";
import { getMaintenanceRequestDetail } from "@/lib/actions/maintenance";
import { createClient } from "@/lib/supabase/server";

function triageBadge(category: string | null) {
  if (!category) {
    return (
      <Badge className="border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300">
        Analysing…
      </Badge>
    );
  }
  const c = category.toLowerCase();
  if (c === "urgent-safety") {
    return (
      <Badge className="border border-red-300 bg-red-100 text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100">
        urgent-safety
      </Badge>
    );
  }
  if (c === "urgent") {
    return (
      <Badge className="border border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-500/10 dark:text-orange-200">
        urgent
      </Badge>
    );
  }
  if (c === "routine") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200">
        routine
      </Badge>
    );
  }
  return (
    <Badge className="border border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
      low-priority
    </Badge>
  );
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  if (!userId) notFound();

  const detail = await getMaintenanceRequestDetail(userId, id);
  if (!detail) notFound();

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
                <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between lg:px-6">
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/dashboard/maintenance"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      ← Maintenance
                    </Link>
                    <h1 className="mt-2 text-base font-semibold tracking-tight">
                      {(() => {
                        const line = detail.description?.split(/\n/)[0]?.trim();
                        return line && line.length > 0 ? line.slice(0, 120) : "Maintenance request";
                      })()}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {detail.propertyAddress ?? "Property"} · {detail.tenantFullName ?? "Tenant"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(detail.status ?? "").toLowerCase() === "resolved" ? (
                      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Resolved
                      </Badge>
                    ) : (detail.status ?? "").toLowerCase() === "open" ? (
                      <ResolveMaintenanceForm requestId={detail.id} />
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">Issue</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-4 text-sm">
                      <p className="whitespace-pre-wrap text-muted-foreground">{detail.description}</p>
                      <p>
                        <span className="text-muted-foreground">Priority (tenant): </span>
                        {detail.priority ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Status: </span>
                        {detail.status ?? "—"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">AI triage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Category:</span>
                        {triageBadge(detail.aiTriageCategory)}
                      </div>
                      {detail.aiTriageSummary ? (
                        <p>
                          <span className="text-muted-foreground">Summary: </span>
                          {detail.aiTriageSummary}
                        </p>
                      ) : null}
                      {detail.triageFromRun?.responseTime ? (
                        <p>
                          <span className="text-muted-foreground">Expected response: </span>
                          {detail.triageFromRun.responseTime}
                        </p>
                      ) : null}
                      {detail.triageFromRun?.recommendedAction ? (
                        <p>
                          <span className="text-muted-foreground">Recommended action: </span>
                          {detail.triageFromRun.recommendedAction}
                        </p>
                      ) : null}
                      <div className="grid gap-1 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          Tenant acknowledged:{" "}
                          {detail.tenantAcknowledgedAt
                            ? new Date(detail.tenantAcknowledgedAt).toLocaleString("en-GB")
                            : "—"}
                        </p>
                        <p>
                          Landlord notified:{" "}
                          {detail.landlordNotifiedAt
                            ? new Date(detail.landlordNotifiedAt).toLocaleString("en-GB")
                            : "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <AssignContractorForm
                    requestId={detail.id}
                    contractorName={detail.contractorName}
                    contractorEmail={detail.contractorEmail}
                    status={detail.status}
                  />

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">Related emails</CardTitle>
                      <p className="text-sm font-normal text-muted-foreground">
                        Tenant acknowledgement and landlord summary (via maintenance agent).
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <MaintenanceRelatedEmailsTable emailLogs={detail.emailLogs} />
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
