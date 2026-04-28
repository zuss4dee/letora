import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (!userId) notFound();

  const detail = await getMaintenanceRequestDetail(userId, id);
  if (!detail) notFound();

  const titleLine = (() => {
    const line = detail.description?.split(/\n/)[0]?.trim();
    return line && line.length > 0 ? line.slice(0, 120) : "Maintenance request";
  })();

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(255,255,255,0.04),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(255,255,255,0.04),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 py-8 md:py-10">
        <header className="flex flex-col gap-4 px-4 sm:flex-row sm:items-start sm:justify-between lg:px-6">
          <div className="min-w-0 flex-1 space-y-3">
            <Link
              href="/dashboard/maintenance"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-zinc-400"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Maintenance
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Issue
            </p>
            <h1 className="font-headline text-2xl font-extralight tracking-[-0.03em] text-foreground md:text-3xl">
              {titleLine}
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
              {detail.propertyAddress ?? "Property"} · {detail.tenantFullName ?? "Tenant"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:pt-10">
            {(detail.status ?? "").toLowerCase() === "resolved" ? (
              <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                Resolved
              </Badge>
            ) : (detail.status ?? "").toLowerCase() === "open" ? (
              <ResolveMaintenanceForm requestId={detail.id} />
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 px-4 lg:px-6">
                  <Card
                    id="request-issue"
                    className="scroll-mt-24 overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60"
                  >
                    <CardHeader className="border-b border-border bg-muted/30">
                      <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">Issue</CardTitle>
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

                  <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
                    <CardHeader className="border-b border-border bg-muted/30">
                      <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">AI triage</CardTitle>
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

                  <div id="assign-contractor" className="scroll-mt-24">
                    <AssignContractorForm
                      requestId={detail.id}
                      contractorName={detail.contractorName}
                      contractorEmail={detail.contractorEmail}
                      status={detail.status}
                    />
                  </div>

                  <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
                    <CardHeader className="border-b border-border bg-muted/30">
                      <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">
                        Related emails
                      </CardTitle>
                      <p className="font-[family-name:var(--font-inter)] text-sm font-normal text-muted-foreground">
                        Tenant acknowledgement, landlord summary, and contractor dispatch emails after you approve them
                        in Approvals.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <MaintenanceRelatedEmailsTable emailLogs={detail.emailLogs} />
                    </CardContent>
                  </Card>
        </div>
      </div>
    </div>
  );
}
