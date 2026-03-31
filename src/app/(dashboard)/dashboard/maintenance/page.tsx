import Link from "next/link";

import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { AddRequestDialog } from "@/components/maintenance/add-request-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { getTenancies } from "@/lib/actions/tenancies";
import { createClient } from "@/lib/supabase/server";

type PriorityUi = "low" | "medium" | "high" | "urgent";
type StatusUi = "open" | "in_progress" | "resolved";

function priorityBadge(priority: string | null) {
  const p = (priority ?? "medium").toLowerCase() as PriorityUi;
  if (p === "low") {
    return (
      <Badge className="border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
        Low
      </Badge>
    );
  }
  if (p === "high") {
    return (
      <Badge className="border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/40 dark:bg-orange-500/10 dark:text-orange-300">
        High
      </Badge>
    );
  }
  if (p === "urgent") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Urgent
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      Medium
    </Badge>
  );
}

function aiTriageBadge(category: string | null) {
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

function truncateSummary(s: string | null, max = 60) {
  if (!s) return "—";
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function statusBadge(status: string | null) {
  const s = (status ?? "open").toLowerCase() as StatusUi;
  if (s === "resolved") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Resolved
      </Badge>
    );
  }
  if (s === "in_progress") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        In Progress
      </Badge>
    );
  }
  return (
    <Badge className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300">
      Open
    </Badge>
  );
}

export default async function MaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  const [requests, tenancies] = userId
    ? await Promise.all([getMaintenanceRequests(userId), getTenancies(userId)])
    : [{ open: [], resolved: [] }, []];

  const tenancyOptions = tenancies.map((t) => ({
    id: t.id,
    label: `${t.propertyAddress ?? "Property"} · ${t.tenantFullName ?? "Tenant"}`,
  }));

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Maintenance</h1>
                    <p className="text-sm text-muted-foreground">
                      Track and manage property maintenance requests.
                    </p>
                  </div>
                  <AddRequestDialog tenancies={tenancyOptions} />
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Open Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Property</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>AI triage</TableHead>
                            <TableHead>AI summary</TableHead>
                            <TableHead>Contractor</TableHead>
                            <TableHead>Date Reported</TableHead>
                            <TableHead>Resolved on</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requests.open.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={11}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No open maintenance requests.
                              </TableCell>
                            </TableRow>
                          ) : (
                            requests.open.map((r: MaintenanceRequestRow) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">
                                  {r.propertyAddress ?? "—"}
                                </TableCell>
                                <TableCell>{r.tenantFullName ?? "—"}</TableCell>
                                <TableCell className="max-w-[360px] truncate">
                                  {truncateSummary(r.description)}
                                </TableCell>
                                <TableCell>{priorityBadge(r.priority)}</TableCell>
                                <TableCell>{aiTriageBadge(r.aiTriageCategory)}</TableCell>
                                <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                                  {truncateSummary(r.aiTriageSummary)}
                                </TableCell>
                                <TableCell className="max-w-[160px] truncate">
                                  {r.contractorName?.trim() || "—"}
                                </TableCell>
                                <TableCell>{r.createdAt?.slice(0, 10) ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground">—</TableCell>
                                <TableCell>{statusBadge(r.status)}</TableCell>
                                <TableCell className="text-right">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/dashboard/maintenance/${r.id}`}>View</Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Resolved Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Property</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>AI triage</TableHead>
                            <TableHead>AI summary</TableHead>
                            <TableHead>Date Reported</TableHead>
                            <TableHead>Resolved on</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requests.resolved.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={10}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No resolved maintenance requests yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            requests.resolved.map((r: MaintenanceRequestRow) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">
                                  {r.propertyAddress ?? "—"}
                                </TableCell>
                                <TableCell>{r.tenantFullName ?? "—"}</TableCell>
                                <TableCell className="max-w-[360px] truncate">
                                  {truncateSummary(r.description)}
                                </TableCell>
                                <TableCell>{priorityBadge(r.priority)}</TableCell>
                                <TableCell>{aiTriageBadge(r.aiTriageCategory)}</TableCell>
                                <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                                  {truncateSummary(r.aiTriageSummary)}
                                </TableCell>
                                <TableCell>{r.createdAt?.slice(0, 10) ?? "—"}</TableCell>
                                <TableCell>
                                  {r.resolvedAt ? r.resolvedAt.slice(0, 10) : "—"}
                                </TableCell>
                                <TableCell>{statusBadge(r.status)}</TableCell>
                                <TableCell className="text-right">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/dashboard/maintenance/${r.id}`}>View</Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
        </div>
      </div>
    </>
  );
}

