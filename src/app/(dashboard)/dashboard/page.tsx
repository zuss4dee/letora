export const dynamic = "force-dynamic";

import Link from "next/link";

import { AiActivityCard, type ActivityRun } from "@/components/dashboard/ai-activity-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailDraftsCard } from "@/components/dashboard/email-drafts-card";
import { SafetyAlertsCard } from "@/components/dashboard/safety-alerts-card";
import {
  getMonthlyRentFromActiveTenancies,
  getOverdueRentPaymentCount,
} from "@/lib/actions/dashboard";
import { getPendingEmailDrafts } from "@/lib/actions/email-drafts";
import { getSafetyAlertsLast7Days } from "@/lib/actions/safety-alerts";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

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
  const userId = user?.id ?? null;

  let totalProperties = 0;
  let activeTenants = 0;
  let monthlyRent = 0;
  let overduePayments = 0;
  let activity: ActivityRun[] = [];
  let properties: PropertyRow[] = [];
  let emailDrafts: Awaited<ReturnType<typeof getPendingEmailDrafts>> = [];
  let safetyAlerts: Awaited<ReturnType<typeof getSafetyAlertsLast7Days>> = [];

  if (userId) {
    const [
      propertiesCountRes,
      tenantsCountRes,
      monthlyRentTotal,
      overdueCount,
      activityRes,
      propertiesRes,
      pendingDrafts,
      alerts,
    ] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("tenant_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      getMonthlyRentFromActiveTenancies(userId),
      getOverdueRentPaymentCount(userId),
      supabase
        .from("agent_runs")
        .select("id,agent_type,status,created_at,payload")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("properties")
        .select("id,address,city")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      getPendingEmailDrafts(userId),
      getSafetyAlertsLast7Days(userId),
    ]);

    emailDrafts = pendingDrafts;
    safetyAlerts = alerts;

    totalProperties = propertiesCountRes.count ?? 0;
    activeTenants = tenantsCountRes.count ?? 0;
    monthlyRent = monthlyRentTotal;
    overduePayments = overdueCount;
    activity = (activityRes.data ?? []).map((row) => ({
      id: row.id as string,
      agent_type: row.agent_type as string | null,
      status: row.status as string | null,
      created_at: row.created_at as string | null,
      payload:
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : null,
    }));
    properties = (propertiesRes.data ?? []) as PropertyRow[];
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
                  {statCard("Total Properties", String(totalProperties))}
                  {statCard("Active Tenants", String(activeTenants))}
                  {statCard("Monthly Rent", gbp.format(monthlyRent))}
                  <Link
                    href="/dashboard/rent-tracker"
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="h-full transition-colors hover:bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Overdue Payments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold tracking-tight">
                          {String(overduePayments)}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>

                {userId ? (
                  <div className="grid gap-4 px-4 lg:px-6">
                    <SafetyAlertsCard alerts={safetyAlerts} />
                    <EmailDraftsCard drafts={emailDrafts} />
                  </div>
                ) : null}

                <div className="grid gap-4 px-4 lg:px-6 xl:grid-cols-2">
                  <AiActivityCard initialRuns={activity} />

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
  );
}


