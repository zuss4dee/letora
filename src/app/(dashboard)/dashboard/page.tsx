import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailDraftsCard } from "@/components/dashboard/email-drafts-card";
import { getPendingEmailDrafts } from "@/lib/actions/email-drafts";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatAgentType(agentType: string | null) {
  if (!agentType) return "Unknown Agent";
  return agentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadge(status: string | null) {
  const normalized = (status ?? "draft").toLowerCase();
  if (normalized === "success" || normalized === "completed") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        {status ?? "Completed"}
      </Badge>
    );
  }
  if (normalized === "failed" || normalized === "error") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        {status ?? "Failed"}
      </Badge>
    );
  }
  if (normalized === "draft" || normalized === "pending") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        {status ?? "Draft"}
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300"
    >
      {status ?? "Unknown"}
    </Badge>
  );
}

function statCard(title: string, value: string) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

type ActivityRow = {
  id: string;
  agent_type: string | null;
  status: string | null;
  created_at: string | null;
};

type PropertyRow = {
  id: string;
  address: string | null;
  city: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;
  const userId = user?.id ?? null;

  let totalProperties = 0;
  let activeTenants = 0;
  let monthlyRent = 0;
  let overduePayments = 0;
  let activity: ActivityRow[] = [];
  let properties: PropertyRow[] = [];
  let emailDrafts: Awaited<ReturnType<typeof getPendingEmailDrafts>> = [];

  if (userId) {
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const monthStartIso = startOfMonth.toISOString().slice(0, 10);
    const [
      propertiesCountRes,
      tenantsCountRes,
      paymentsRes,
      activityRes,
      propertiesRes,
      pendingDrafts,
    ] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("tenant_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("rent_payments")
        .select("id,status,due_date,amount,paid_date")
        .eq("user_id", userId),
      supabase
        .from("agent_actions")
        .select("id,agent_type,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("properties")
        .select("id,address,city")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      getPendingEmailDrafts(userId),
    ]);

    emailDrafts = pendingDrafts;

    totalProperties = propertiesCountRes.count ?? 0;
    activeTenants = tenantsCountRes.count ?? 0;
    monthlyRent = (paymentsRes.data ?? [])
      .filter((row) => {
        const status = (row.status ?? "").toLowerCase();
        return status === "paid" && !!row.paid_date && row.paid_date >= monthStartIso;
      })
      .reduce((sum, row) => {
        const amount =
          typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    overduePayments = (paymentsRes.data ?? []).filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return status === "overdue" || (status === "pending" && !!row.due_date && row.due_date < today);
    }).length;
    activity = (activityRes.data ?? []) as ActivityRow[];
    properties = (propertiesRes.data ?? []) as PropertyRow[];
  }

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
                <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
                  {statCard("Total Properties", String(totalProperties))}
                  {statCard("Active Tenants", String(activeTenants))}
                  {statCard("Monthly Rent", gbp.format(monthlyRent))}
                  {statCard("Overdue Payments", String(overduePayments))}
                </div>

                {userId ? (
                  <div className="px-4 lg:px-6">
                    <EmailDraftsCard drafts={emailDrafts} />
                  </div>
                ) : null}

                <div className="grid gap-4 px-4 lg:px-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Agent Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activity.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No recent agent activity.
                              </TableCell>
                            </TableRow>
                          ) : (
                            activity.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">
                                  {formatAgentType(row.agent_type)}
                                </TableCell>
                                <TableCell>{statusBadge(row.status)}</TableCell>
                                <TableCell>
                                  {row.created_at
                                    ? new Date(row.created_at).toLocaleDateString("en-GB")
                                    : "—"}
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
                      <CardTitle>Properties Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {properties.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No properties found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            properties.map((property) => (
                              <TableRow key={property.id}>
                                <TableCell className="font-medium">
                                  {property.address ?? "—"}
                                </TableCell>
                                <TableCell>{property.city ?? "—"}</TableCell>
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


