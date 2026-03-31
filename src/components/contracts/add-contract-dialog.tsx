"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { addContract } from "@/lib/actions/contracts";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import {
  addContractSchema,
  CONTRACT_TYPE_OPTIONS,
  type AddContractInput,
} from "@/lib/validations/contracts";
import type { PropertyPickListItem } from "@/lib/actions/properties";
import type { TenantPickListItem } from "@/lib/actions/tenants";

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

export function AddContractDialog({
  properties,
  tenants,
}: {
  properties: PropertyPickListItem[];
  tenants: TenantPickListItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddContractInput>(
    () => ({
      propertyId: properties[0]?.id ?? "",
      tenantId: tenants[0]?.id ?? "",
      contractType: CONTRACT_TYPE_OPTIONS[0],
      startDate: "",
      endDate: "",
      monthlyRent: 1,
      depositAmount: 0,
      specialClauses: "",
    }),
    [properties, tenants],
  );

  const form = useForm<AddContractInput>({
    resolver: zodResolver(addContractSchema) as Resolver<AddContractInput>,
    defaultValues,
  });

  const prevOpenRef = useRef(false);

  /** Only reset when the dialog opens, not when parent re-renders with new list references while open. */
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSubmitError(null);
      form.reset(defaultValues);
    }
    prevOpenRef.current = open;
  }, [open, defaultValues, form]);

  async function onSubmit(values: AddContractInput) {
    setSubmitError(null);
    try {
      await addContract({
        tenantId: values.tenantId,
        propertyId: values.propertyId,
        contractType: values.contractType,
        startDate: values.startDate,
        endDate: values.endDate,
        monthlyRent: values.monthlyRent,
        depositAmount: values.depositAmount,
        specialClauses: values.specialClauses,
      });
      toast.success("Contract created.");
      form.reset(defaultValues);
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create contract";
      setSubmitError(msg);
      toast.error(msg);
    }
  }

  const disabled = properties.length === 0 || tenants.length === 0;
  const isSubmitting = form.formState.isSubmitting;
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
          disabled={disabled}
        >
          New Contract
        </Button>
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
          <DialogDescription>Create a new tenancy contract.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="cc-property">Property</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id="cc-property">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address?.trim() || "Property"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.propertyId ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.propertyId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="cc-tenant">Tenant</Label>
              <Controller
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id="cc-tenant">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.fullName?.trim() || "Tenant"}
                          {t.email ? ` (${t.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tenantId ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.tenantId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="cc-type">Contract type</Label>
              <Controller
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.contractType ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.contractType.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="cc-start">Start date</Label>
                <Input id="cc-start" type="date" {...form.register("startDate")} />
                {errors.startDate ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.startDate.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="cc-end">End date</Label>
                <Input id="cc-end" type="date" {...form.register("endDate")} />
                {errors.endDate ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.endDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="cc-rent">Monthly rent</Label>
                <Input
                  id="cc-rent"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 950.00"
                  {...form.register("monthlyRent", { valueAsNumber: true })}
                />
                {errors.monthlyRent ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.monthlyRent.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="cc-deposit">Deposit amount</Label>
                <Input
                  id="cc-deposit"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 1425.00"
                  {...form.register("depositAmount", { valueAsNumber: true })}
                />
                {errors.depositAmount ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.depositAmount.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="cc-clauses">Special clauses</Label>
              <Textarea
                id="cc-clauses"
                placeholder="e.g. No pets allowed; Garden maintenance by tenant"
                rows={4}
                {...form.register("specialClauses")}
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
              {isSubmitting ? "Creating…" : "Create contract"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
