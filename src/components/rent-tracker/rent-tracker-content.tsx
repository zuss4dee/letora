"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddRentPaymentDialog } from "@/components/rent-tracker/add-rent-payment-dialog";
import {
  deleteRentPayment,
  markRentOverdue,
  markRentPaid,
  type RentPaymentListRow,
} from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { TenancyRow } from "@/lib/actions/tenancies";

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

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDisplayStatus(
  p: RentPaymentListRow,
  todayIso: string,
): "paid" | "overdue" | "pending" {
  const st = (p.status ?? "").toLowerCase();
  if (st === "paid") return "paid";
  if (st === "overdue") return "overdue";
  if (st === "pending" && p.due_date && p.due_date < todayIso) return "overdue";
  return "pending";
}

function statusBadge(display: "paid" | "overdue" | "pending") {
  if (display === "paid") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Paid
      </Badge>
    );
  }
  if (display === "overdue") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Overdue
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      Pending
    </Badge>
  );
}

export function RentTrackerContent({
  payments,
  stats,
  tenancies,
  todayIso,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  tenancies: TenancyRow[];
  todayIso: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => payments, [payments]);

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      toast.success("Updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Rent Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track rent payments across your properties.
          </p>
        </div>
        <AddRentPaymentDialog tenancies={tenancies} />
      </div>

      <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total expected this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {gbp.format(stats.expectedThisMonth)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total received this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {gbp.format(stats.receivedThisMonth)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{stats.overdueCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Paid date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No rent payments yet. Add a payment to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => {
                    const display = getDisplayStatus(p, todayIso);
                    const dbStatus = (p.status ?? "").toLowerCase();
                    const showMarkPaid = dbStatus !== "paid";
                    const showMarkOverdue = dbStatus === "pending";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[200px] font-medium">
                          {p.propertyAddress ?? "—"}
                        </TableCell>
                        <TableCell>{p.tenantName ?? "—"}</TableCell>
                        <TableCell>{gbp.format(p.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.due_date ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.paid_date ?? "—"}</TableCell>
                        <TableCell>{statusBadge(display)}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {p.notes?.trim() ? p.notes : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {showMarkPaid ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busyId === p.id}
                                onClick={() =>
                                  void run(p.id, () => markRentPaid(p.id, todayIso))
                                }
                              >
                                Mark paid
                              </Button>
                            ) : null}
                            {showMarkOverdue ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busyId === p.id}
                                onClick={() => void run(p.id, () => markRentOverdue(p.id))}
                              >
                                Mark overdue
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={busyId === p.id}
                              aria-label="Delete payment"
                              onClick={() =>
                                void run(p.id, () => deleteRentPayment(p.id))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
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
  );
}
