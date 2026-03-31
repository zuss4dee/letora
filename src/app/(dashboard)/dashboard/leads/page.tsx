import { notFound } from "next/navigation";

import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { getLeads, type LeadListRow } from "@/lib/actions/leads";
import { getPropertyPickList } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function formatBudget(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const base =
    "border font-normal capitalize dark:border-transparent dark:bg-opacity-15";
  const map: Record<string, string> = {
    new: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-500/15 dark:text-blue-300",
    contacted:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/15 dark:text-amber-200",
    viewing:
      "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-900/40 dark:bg-purple-500/15 dark:text-purple-200",
    applied:
      "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-500/15 dark:text-indigo-200",
    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/15 dark:text-emerald-300",
    rejected:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/15 dark:text-red-300",
  };
  return (
    <Badge className={cn(base, map[s] ?? map.new)}>
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

function qualifiedBadge(q: string) {
  const s = q.toLowerCase();
  const base = "border font-normal capitalize dark:border-transparent dark:bg-opacity-15";
  const map: Record<string, string> = {
    pending:
      "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
    qualified:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/15 dark:text-emerald-300",
    disqualified:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/15 dark:text-red-300",
  };
  return (
    <Badge className={cn(base, map[s] ?? map.pending)}>
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

function computeLeadStats(leads: LeadListRow[]) {
  return {
    total: leads.length,
    newCount: leads.filter((l) => l.status === "new").length,
    qualifiedCount: leads.filter((l) => l.qualifiedStatus === "qualified").length,
    viewingCount: leads.filter((l) => l.status === "viewing").length,
  };
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const [leads, properties] = await Promise.all([getLeads(), getPropertyPickList()]);

  const stats = computeLeadStats(leads);

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Leads</h1>
                    <p className="text-sm text-muted-foreground">
                      Track and manage prospective tenants.
                    </p>
                  </div>
                  <AddLeadDialog properties={properties} />
                </div>

                <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total leads
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.total}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">{stats.newCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Qualified
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">
                        {stats.qualifiedCount}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Viewing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold tracking-tight">
                        {stats.viewingCount}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>All leads</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="w-full overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Property</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Budget</TableHead>
                              <TableHead>Move-in</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Qualified</TableHead>
                              <TableHead className="text-right min-w-[280px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leads.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={10}
                                  className="py-10 text-center text-sm text-muted-foreground"
                                >
                                  No leads yet. Add a lead to get started.
                                </TableCell>
                              </TableRow>
                            ) : (
                              leads.map((lead) => (
                                <TableRow key={lead.id}>
                                  <TableCell className="max-w-[140px] truncate font-medium">
                                    {lead.name}
                                  </TableCell>
                                  <TableCell className="max-w-[180px] truncate">
                                    {lead.email ?? "—"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {lead.phone ?? "—"}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {lead.propertyAddress}
                                  </TableCell>
                                  <TableCell>{lead.source ?? "—"}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {formatBudget(lead.budget)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {lead.moveInDate ?? "—"}
                                  </TableCell>
                                  <TableCell>{statusBadge(lead.status)}</TableCell>
                                  <TableCell>{qualifiedBadge(lead.qualifiedStatus)}</TableCell>
                                  <TableCell className="text-right">
                                    <LeadRowActions
                                      leadId={lead.id}
                                      status={lead.status}
                                      qualifiedStatus={lead.qualifiedStatus}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
        </div>
      </div>
    </>
  );
}
