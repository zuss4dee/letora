"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { logPayment } from "@/lib/actions/tenancies";
import { type LogPaymentInput, logPaymentSchema } from "@/lib/validations/tenancy";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LogPaymentDialog({
  tenancyId,
  rentPaymentId,
  defaultAmountPaid,
  triggerLabel,
  triggerClassName,
}: {
  tenancyId: string;
  rentPaymentId?: string | null;
  defaultAmountPaid: number;
  triggerLabel: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<LogPaymentInput>(
    () => ({
      tenancyId,
      rentPaymentId: rentPaymentId ?? undefined,
      amountPaid: defaultAmountPaid,
      paidOn: todayIso(),
      paymentMethod: "bank_transfer",
      notes: "",
    }),
    [defaultAmountPaid, rentPaymentId, tenancyId],
  );

  const form = useForm<LogPaymentInput>({
    resolver: zodResolver(logPaymentSchema) as Resolver<LogPaymentInput>,
    defaultValues,
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LogPaymentInput) {
    setSubmitError(null);
    const result = await logPayment(values);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(triggerClassName)}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
          <DialogDescription>Record a rent payment for this tenancy.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="amountPaid">Amount paid (£)</Label>
              <Input
                id="amountPaid"
                type="number"
                min={0}
                step="1"
                {...form.register("amountPaid", { valueAsNumber: true })}
                onFocus={(e) => e.target.select()}
              />
              {form.formState.errors.amountPaid?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.amountPaid.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paidOn">Payment date</Label>
              <Input id="paidOn" type="date" {...form.register("paidOn")} />
              {form.formState.errors.paidOn?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.paidOn.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Select
              value={form.watch("paymentMethod")}
              onValueChange={(v) =>
                form.setValue("paymentMethod", v as LogPaymentInput["paymentMethod"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="standing_order">Standing order</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.paymentMethod?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.paymentMethod.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="e.g. Paid via standing order" {...form.register("notes")} />
          </div>

          {submitError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

