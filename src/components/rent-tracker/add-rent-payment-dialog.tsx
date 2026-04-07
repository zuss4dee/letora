"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";

import { addRentPayment } from "@/lib/actions/rent-tracker";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import { addRentPaymentSchema, type AddRentPaymentInput } from "@/lib/validations/rent-tracker";
import type { TenancyRow } from "@/lib/actions/tenancies";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";

export function AddRentPaymentDialog({
  tenancies,
  trigger,
}: {
  tenancies: TenancyRow[];
  trigger?: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddRentPaymentInput>(
    () => ({
      tenancyId: tenancies[0]?.id ?? "",
      amount:
        tenancies[0]?.monthlyRent && tenancies[0].monthlyRent > 0
          ? tenancies[0].monthlyRent
          : 1,
      dueDate: "",
      notes: "",
    }),
    [tenancies],
  );

  const form = useForm<AddRentPaymentInput>({
    resolver: zodResolver(addRentPaymentSchema),
    defaultValues,
  });

  const tenancyId = form.watch("tenancyId");
  const prevOpenRef = useRef(false);
  const prevTenancyIdForAmountRef = useRef<string | null>(null);

  /** Only reset when the dialog opens, not when parent re-renders with new list references while open. */
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSubmitError(null);
      prevTenancyIdForAmountRef.current = null;
      form.reset(defaultValues);
    }
    prevOpenRef.current = open;
  }, [open, defaultValues, form]);

  /** Sync amount to selected tenancy’s rent when tenancy changes, not on every tenancies[] identity change. */
  useEffect(() => {
    if (!open) return;
    if (prevTenancyIdForAmountRef.current === tenancyId) return;
    prevTenancyIdForAmountRef.current = tenancyId;
    const t = tenancies.find((x) => x.id === tenancyId);
    if (t?.monthlyRent != null && t.monthlyRent > 0) {
      form.setValue("amount", t.monthlyRent, { shouldValidate: true });
    }
  }, [open, tenancyId, tenancies, form]);

  async function onSubmit(values: AddRentPaymentInput) {
    setSubmitError(null);
    try {
      await addRentPayment({
        tenancyId: values.tenancyId,
        amount: values.amount,
        dueDate: values.dueDate,
        notes: values.notes,
      });
      toast.success("Payment added.");
      form.reset(defaultValues);
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add payment";
      setSubmitError(msg);
      toast.error(msg);
    }
  }

  const disabled = tenancies.length === 0;
  const isSubmitting = form.formState.isSubmitting;
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            disabled={disabled}
          >
            Add Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add rent payment</DialogTitle>
          <DialogDescription>Add a rent payment for a tenancy.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="rt-tenancy">Tenancy</Label>
              <Controller
                control={form.control}
                name="tenancyId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id="rt-tenancy">
                      <SelectValue placeholder="Select tenancy" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenancies.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {`${t.propertyAddress ?? "Property"} · ${t.tenantFullName ?? "Tenant"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tenancyId ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.tenancyId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="rt-amount">Amount</Label>
              <Input
                id="rt-amount"
                type="number"
                step="0.01"
                min={0}
                placeholder="e.g. 950.00"
                {...form.register("amount", { valueAsNumber: true })}
              />
              {errors.amount ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="rt-due">Due date</Label>
              <Input id="rt-due" type="date" {...form.register("dueDate")} />
              {errors.dueDate ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.dueDate.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="rt-notes">Notes</Label>
              <Textarea
                id="rt-notes"
                placeholder="e.g. Late payment agreed"
                rows={3}
                {...form.register("notes")}
              />
            </div>

            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className={dialogFormFooterClass("mt-4")}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Adding…" : "Add payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
