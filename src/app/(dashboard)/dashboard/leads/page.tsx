/**
 * Supabase migration (leads table, no FK constraints)
 *
 * ```sql
 * create table if not exists public.leads (
 *   id uuid primary key,
 *   user_id uuid not null,
 *   property_id uuid not null,
 *   full_name text not null,
 *   email text not null,
 *   phone text not null,
 *   move_in_date date,
 *   source text,
 *   notes text,
 *   status text not null default 'new',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table public.leads enable row level security;
 *
 * create policy "leads_select_own"
 * on public.leads for select
 * using (user_id = auth.uid());
 *
 * create policy "leads_insert_own"
 * on public.leads for insert
 * with check (user_id = auth.uid());
 *
 * create policy "leads_update_own"
 * on public.leads for update
 * using (user_id = auth.uid())
 * with check (user_id = auth.uid());
 *
 * create policy "leads_delete_own"
 * on public.leads for delete
 * using (user_id = auth.uid());
 * ```
 */

import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLeads } from "@/lib/actions/leads";
import { getProperties } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";

type LeadStatus = "new" | "contacted" | "qualified" | "rejected";

function statusBadge(status: string | null) {
  const s = (status ?? "new").toLowerCase() as LeadStatus;
  if (s === "contacted") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        Contacted
      </Badge>
    );
  }
  if (s === "qualified") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Qualified
      </Badge>
    );
  }
  if (s === "rejected") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Rejected
      </Badge>
    );
  }
  return (
    <Badge className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300">
      New
    </Badge>
  );
}

function LeadsTable({
  title,
  rows,
  emptyState,
  allowQualifyReject,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getLeads>>["new_leads"];
  emptyState: string;
  allowQualifyReject: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Property Interested In</TableHead>
              <TableHead>Move-in Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name ?? "—"}</TableCell>
                  <TableCell>{lead.email ?? "—"}</TableCell>
                  <TableCell>{lead.phone ?? "—"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    {lead.propertyInterestedIn ?? "—"}
                  </TableCell>
                  <TableCell>{lead.moveInDate ?? "—"}</TableCell>
                  <TableCell>{lead.source ?? "—"}</TableCell>
                  <TableCell>{statusBadge(lead.status)}</TableCell>
                  <TableCell className="text-right">
                    <LeadRowActions leadId={lead.id} allowQualifyReject={allowQualifyReject} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [leads, properties] = userId
    ? await Promise.all([getLeads(userId), getProperties(userId)])
    : [{ new_leads: [], qualified: [], rejected: [] }, []];

  const propertyOptions = properties.map((property) => ({
    id: property.id,
    label: `${property.address ?? "Property"}${property.city ? `, ${property.city}` : ""}`,
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
                    <h1 className="text-base font-semibold tracking-tight">Leads</h1>
                    <p className="text-sm text-muted-foreground">
                      Track and qualify prospective tenants for your properties.
                    </p>
                  </div>
                  <AddLeadDialog properties={propertyOptions} />
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <LeadsTable
                    title="New Leads"
                    rows={leads.new_leads}
                    emptyState="No new leads yet."
                    allowQualifyReject
                  />
                  <LeadsTable
                    title="Qualified Leads"
                    rows={leads.qualified}
                    emptyState="No qualified leads yet."
                    allowQualifyReject={false}
                  />
                  <LeadsTable
                    title="Rejected Leads"
                    rows={leads.rejected}
                    emptyState="No rejected leads."
                    allowQualifyReject={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

