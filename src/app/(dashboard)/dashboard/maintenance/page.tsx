/**
 * Supabase migration (add/replace maintenance_requests table)
 *
 * ```sql
 * create table if not exists public.maintenance_requests (
 *   id uuid primary key,
 *   user_id uuid references auth.users (id),
 *   property_id uuid references public.properties (id),
 *   tenant_id uuid references public.tenant_profiles (id),
 *   title text not null,
 *   description text not null,
 *   priority text not null default 'medium',
 *   status text not null default 'open',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table public.maintenance_requests enable row level security;
 *
 * create policy "maintenance_requests_select_own"
 * on public.maintenance_requests for select
 * using (user_id = auth.uid());
 *
 * create policy "maintenance_requests_insert_own"
 * on public.maintenance_requests for insert
 * with check (user_id = auth.uid());
 *
 * create policy "maintenance_requests_update_own"
 * on public.maintenance_requests for update
 * using (user_id = auth.uid())
 * with check (user_id = auth.uid());
 *
 * create policy "maintenance_requests_delete_own"
 * on public.maintenance_requests for delete
 * using (user_id = auth.uid());
 * ```
 */

import Link from "next/link";

import { AppSidebar } from "@/components/app-sidebar";
import { AddRequestDialog } from "@/components/maintenance/add-request-dialog";
import { SiteHeader } from "@/components/site-header";
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
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
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
  const userEmail = user?.email ?? null;

  const [requests, properties, tenants] = userId
    ? await Promise.all([
        getMaintenanceRequests(userId),
        getProperties(userId),
        getTenants(userId),
      ])
    : [
        { open: [], resolved: [] },
        [],
        [],
      ];

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: `${p.address ?? "Property"}${p.city ? `, ${p.city}` : ""}`,
  }));

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label: `${t.fullName ?? "Tenant"}${t.email ? ` (${t.email})` : ""}`,
  }));

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
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Maintenance</h1>
                    <p className="text-sm text-muted-foreground">
                      Track and manage property maintenance requests.
                    </p>
                  </div>
                  <AddRequestDialog properties={propertyOptions} tenants={tenantOptions} />
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
                            <TableHead>Issue</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Date Reported</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requests.open.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No open maintenance requests.
                              </TableCell>
                            </TableRow>
                          ) : (
                            requests.open.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">
                                  {r.propertyAddress ?? "—"}
                                </TableCell>
                                <TableCell>{r.tenantFullName ?? "—"}</TableCell>
                                <TableCell className="max-w-[360px] truncate">
                                  {r.title ?? "—"}
                                </TableCell>
                                <TableCell>{priorityBadge(r.priority)}</TableCell>
                                <TableCell>{r.createdAt?.slice(0, 10) ?? "—"}</TableCell>
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
                            <TableHead>Issue</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Date Reported</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requests.resolved.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No resolved maintenance requests yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            requests.resolved.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">
                                  {r.propertyAddress ?? "—"}
                                </TableCell>
                                <TableCell>{r.tenantFullName ?? "—"}</TableCell>
                                <TableCell className="max-w-[360px] truncate">
                                  {r.title ?? "—"}
                                </TableCell>
                                <TableCell>{priorityBadge(r.priority)}</TableCell>
                                <TableCell>{r.createdAt?.slice(0, 10) ?? "—"}</TableCell>
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
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

