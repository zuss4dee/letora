"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addTenancy } from "@/lib/actions/tenancies";
import { type AddTenancyInput, addTenancySchema } from "@/lib/validations/tenancy";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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

export function AddTenancyDialog({
  properties,
  tenants,
  trigger,
}: {
  properties: Array<{ id: string; label: string }>;
  tenants: Array<{ id: string; label: string }>;
  trigger?: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddTenancyInput>(
    () => ({
      propertyId: properties[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      tenantId: tenants[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      startDate: "",
      endDate: "",
      moveInDate: "",
      monthlyRent: 0,
      depositAmount: 0,
    }),
    [properties, tenants],
  );

  const form = useForm<AddTenancyInput>({
    resolver: zodResolver(addTenancySchema) as Resolver<AddTenancyInput>,
    defaultValues,
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: AddTenancyInput) {
    setSubmitError(null);
    const result = await addTenancy(values);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const disabled = properties.length === 0 || tenants.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            disabled={disabled}
          >
            Add Tenancy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add tenancy</DialogTitle>
          <DialogDescription>
            Link a tenant to a property and set rent terms. Property and tenant are shown by address
            and name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="at-property">Property</Label>
              <Select
                value={form.watch("propertyId")}
                onValueChange={(v) =>
                  form.setValue("propertyId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="at-property" className="w-full">
                  <SelectValue placeholder="Select by address" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.propertyId?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.propertyId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="at-tenant">Tenant</Label>
              <Select
                value={form.watch("tenantId")}
                onValueChange={(v) =>
                  form.setValue("tenantId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="at-tenant" className="w-full">
                  <SelectValue placeholder="Name (email)" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.tenantId?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.tenantId.message}
                </p>
              ) : null}
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="at-start">Start date</Label>
                <Input id="at-start" className="w-full" type="date" {...form.register("startDate")} />
                {form.formState.errors.startDate?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.startDate.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="at-end">End date</Label>
                <Input id="at-end" className="w-full" type="date" {...form.register("endDate")} />
                {form.formState.errors.endDate?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.endDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="at-movein">Move-in date (optional)</Label>
              <Input id="at-movein" className="w-full" type="date" {...form.register("moveInDate")} />
              <p className="text-xs text-muted-foreground">
                If blank, onboarding and reminders use the tenancy start date.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="at-rent">Monthly rent (£)</Label>
                <Input
                  id="at-rent"
                  className="w-full"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 1200"
                  {...form.register("monthlyRent", { valueAsNumber: true })}
                />
                {form.formState.errors.monthlyRent?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.monthlyRent.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="at-dep">Deposit (£)</Label>
                <Input
                  id="at-dep"
                  className="w-full"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 1200"
                  {...form.register("depositAmount", { valueAsNumber: true })}
                />
                {form.formState.errors.depositAmount?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.depositAmount.message}
                  </p>
                ) : null}
              </div>
            </div>

            {submitError ? (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className={dialogFormFooterClass()}>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Adding…" : "Add tenancy"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
