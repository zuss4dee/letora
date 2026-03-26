"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const addPaymentSchema = z.object({
  propertyId: z.string().uuid("Select a property"),
  tenantId: z.string().uuid().optional(),
  amount: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return 0;
      const n = typeof val === "number" ? val : Number(val);
      return Number.isNaN(n) ? 0 : n;
    },
    z.number().min(1),
  ),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

type AddPaymentInput = z.output<typeof addPaymentSchema>;

type RentPayment = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  tenantId: string | null;
  tenantName: string;
  tenantEmail: string | null;
  amount: number;
  dueDate: string | null;
  paidDate: string | null;
  status: "pending" | "paid" | "overdue";
  notes: string | null;
  createdAt: string | null;
};

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function statusBadge(status: RentPayment["status"]) {
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

export function RentTrackerClient({
  properties,
  tenants,
}: {
  properties: Array<{ id: string; address: string; city: string | null }>;
  tenants: Array<{ id: string; fullName: string; propertyId: string | null }>;
}) {
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const form = useForm<AddPaymentInput>({
    resolver: zodResolver(addPaymentSchema) as Resolver<AddPaymentInput>,
    defaultValues: {
      propertyId: properties[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      amount: 0,
      dueDate: "",
      notes: "",
    },
  });

  async function fetchPayments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rent-tracker");
      const data = (await res.json()) as { payments?: RentPayment[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rent payments");
      setPayments(data.payments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch rent payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPayments();
  }, []);

  async function onAddPayment(values: AddPaymentInput) {
    setError(null);
    const payload = {
      propertyId: values.propertyId,
      tenantId: values.tenantId ?? null,
      amount: values.amount,
      dueDate: values.dueDate,
      notes: values.notes ?? "",
    };
    const res = await fetch("/api/rent-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to add payment");
      return;
    }
    setOpen(false);
    form.reset({
      propertyId: values.propertyId,
      tenantId: undefined,
      amount: 0,
      dueDate: "",
      notes: "",
    });
    await fetchPayments();
  }

  async function markPaid(id: string) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/rent-tracker/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update payment");
      await fetchPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update payment");
    } finally {
      setSavingId(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const overduePayments = useMemo(
    () =>
      payments.filter(
        (p) => p.status === "overdue" || (p.status === "pending" && !!p.dueDate && p.dueDate < today),
      ),
    [payments, today],
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const paymentsReceived = useMemo(
    () =>
      payments
        .filter((p) => p.status === "paid" && !!p.paidDate && p.paidDate >= monthStartIso)
        .reduce((sum, p) => sum + p.amount, 0),
    [payments, monthStartIso],
  );

  const totalMonthly = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const selectedPropertyId = form.watch("propertyId");
  const filteredTenants = tenants.filter((t) => t.propertyId === selectedPropertyId);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Rent Tracker</h1>
          <p className="text-sm text-muted-foreground">Track rent payments across all properties.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300">
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
              <DialogDescription>Create a new rent payment record.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onAddPayment)}>
              <div className="grid gap-2">
                <Label>Property</Label>
                <Select
                  value={form.watch("propertyId")}
                  onValueChange={(v) => form.setValue("propertyId", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                        {p.city ? `, ${p.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tenant</Label>
                <Select
                  value={form.watch("tenantId") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("tenantId", v === "__none" ? undefined : v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTenants.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No tenants for selected property
                      </SelectItem>
                    ) : (
                      filteredTenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.fullName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (£)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="1"
                    {...form.register("amount", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" {...form.register("dueDate")} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : "Save Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <div className="px-4 lg:px-6">
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly Rent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{gbp.format(totalMonthly)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payments Received This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{gbp.format(paymentsReceived)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{overduePayments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : overduePayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No overdue payments.
                    </TableCell>
                  </TableRow>
                ) : (
                  overduePayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.propertyName}</TableCell>
                      <TableCell>{p.tenantName}</TableCell>
                      <TableCell>{gbp.format(p.amount)}</TableCell>
                      <TableCell>{p.dueDate ?? "—"}</TableCell>
                      <TableCell>{daysOverdue(p.dueDate)}</TableCell>
                      <TableCell>{statusBadge("overdue")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void markPaid(p.id)}
                          disabled={savingId === p.id}
                        >
                          Mark Paid
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
            <CardTitle>All Payments</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No payment records yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.propertyName}</TableCell>
                      <TableCell>{p.tenantName}</TableCell>
                      <TableCell>{gbp.format(p.amount)}</TableCell>
                      <TableCell>{p.dueDate ?? "—"}</TableCell>
                      <TableCell>{p.paidDate ?? "—"}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        {p.status !== "paid" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void markPaid(p.id)}
                            disabled={savingId === p.id}
                          >
                            Mark Paid
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        )}
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
  );
}

