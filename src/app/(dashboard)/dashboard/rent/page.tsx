import { AddTenancyDialog } from "@/components/rent/add-tenancy-dialog";
import { LogPaymentDialog } from "@/components/rent/log-payment-dialog";
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
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
import {
  autoGeneratePendingPayments,
  getTenancies,
  getThisMonthPayments,
} from "@/lib/actions/tenancies";
import { createClient } from "@/lib/supabase/server";

type TenancyStatusUi = "active" | "expiring" | "expired";
type PaymentStatusUi = "paid" | "overdue" | "pending";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function tenancyStatusBadge(status: TenancyStatusUi) {
  if (status === "active") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Active
      </Badge>
    );
  }
  if (status === "expiring") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
      Expired
    </Badge>
  );
}

function paymentStatusBadge(status: PaymentStatusUi) {
  if (status === "paid") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Paid
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Overdue
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      Pending
    </Badge>
  );
}

function parseIsoDate(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function classifyTenancy(endDateIso: string | null): TenancyStatusUi {
  const now = new Date();
  const end = parseIsoDate(endDateIso);
  if (!end) return "active";
  if (end.getTime() < now.getTime()) return "expired";
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (end.getTime() - now.getTime() <= sixtyDaysMs) return "expiring";
  return "active";
}

export default async function RentTrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  if (userId) {
    await autoGeneratePendingPayments(userId);
  }

  const [properties, tenants, tenancies, payments] = userId
    ? await Promise.all([
        getProperties(userId),
        getTenants(userId),
        getTenancies(userId),
        getThisMonthPayments(userId),
      ])
    : [[], [], [], []];

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: p.address ?? "Property",
  }));

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label: `${t.fullName ?? "Tenant"}${t.email ? ` (${t.email})` : ""}`,
  }));

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Rent Tracker</h1>
                    <p className="text-sm text-muted-foreground">
                      Create tenancies, track payments, and manage arrears.
                    </p>
                  </div>
                  <AddTenancyDialog properties={propertyOptions} tenants={tenantOptions} />
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Active tenancies</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Property</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Monthly Rent</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenancies.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No tenancies yet. Add your first tenancy to start tracking rent.
                              </TableCell>
                            </TableRow>
                          ) : (
                            tenancies.map((t) => {
                              const uiStatus = classifyTenancy(t.endDate);
                              const amount = t.monthlyRent ?? 0;
                              const tenancyId = t.id;
                              return (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium">
                                    {t.propertyAddress ?? "—"}
                                  </TableCell>
                                  <TableCell>{t.tenantFullName ?? "—"}</TableCell>
                                  <TableCell>{gbp.format(amount)}</TableCell>
                                  <TableCell>{t.startDate ?? "—"}</TableCell>
                                  <TableCell>{t.endDate ?? "—"}</TableCell>
                                  <TableCell>{tenancyStatusBadge(uiStatus)}</TableCell>
                                  <TableCell className="text-right">
                                    <LogPaymentDialog
                                      tenancyId={tenancyId}
                                      defaultAmountPaid={amount}
                                      triggerLabel="Log Payment"
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>This month&apos;s payments</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Property</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount Due</TableHead>
                            <TableHead>Amount Paid</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No payments due this month yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            payments.map((p) => {
                              const status = (p.status ?? "pending") as PaymentStatusUi;
                              const amountDue = p.amountDue ?? 0;
                              const amountPaid = p.amountPaid ?? 0;
                              const canMarkPaid = status === "pending" || status === "overdue";
                              return (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">
                                    {p.propertyAddress ?? "—"}
                                  </TableCell>
                                  <TableCell>{p.tenantFullName ?? "—"}</TableCell>
                                  <TableCell>{p.dueDate ?? "—"}</TableCell>
                                  <TableCell>{gbp.format(amountDue)}</TableCell>
                                  <TableCell>
                                    {amountPaid === 0 ? (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    ) : (
                                      gbp.format(amountPaid)
                                    )}
                                  </TableCell>
                                  <TableCell>{paymentStatusBadge(status)}</TableCell>
                                  <TableCell className="text-right">
                                    {canMarkPaid && p.tenancyId ? (
                                      <LogPaymentDialog
                                        tenancyId={p.tenancyId}
                                        rentPaymentId={p.id}
                                        defaultAmountPaid={amountDue}
                                        triggerLabel="Mark Paid"
                                      />
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
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

