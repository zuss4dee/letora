"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactElement } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addTenancy } from "@/lib/actions/tenancies";
import { getPendingApprovalsForTenancy } from "@/lib/actions/agent-approvals";
import { type AddTenancyInput, addTenancySchema } from "@/lib/validations/tenancy";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  properties: Array<{ id: string; label: string }>;
  tenants: Array<{ id: string; label: string }>;
  trigger?: ReactElement;
  /** When set with `onOpenChange`, the dialog is controlled (no trigger rendered). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [postCreate, setPostCreate] = useState<{ hasPendingApproval: boolean } | null>(null);
  const wasOpenRef = useRef(false);

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

  function handleOpenChange(next: boolean) {
    if (next && !wasOpenRef.current) {
      setSubmitError(null);
      form.reset(defaultValues);
    } else if (!next) {
      setPostCreate(null);
      setSubmitError(null);
    }
    wasOpenRef.current = next;
    if (isControlled) {
      onOpenChangeProp?.(next);
    } else {
      setInternalOpen(next);
    }
  }

  async function onSubmit(values: AddTenancyInput) {
    setSubmitError(null);
    const result = await addTenancy(values);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    router.refresh();

    let pending = await getPendingApprovalsForTenancy(result.tenancyId);
    if (pending.length === 0) {
      await new Promise((r) => setTimeout(r, 800));
      pending = await getPendingApprovalsForTenancy(result.tenancyId);
    }

    setPostCreate({ hasPendingApproval: pending.length > 0 });
  }

  const disabled = properties.length === 0 || tenants.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled ? (
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
      ) : null}
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>{postCreate ? "Tenancy added" : "Add tenancy"}</DialogTitle>
          <DialogDescription>
            {postCreate
              ? "You can review any onboarding approvals from here or use Approvals in the sidebar."
              : "Link a tenant to a property and set rent terms. Property and tenant are shown by address and name."}
          </DialogDescription>
        </DialogHeader>

        {postCreate ? (
          <div className={DIALOG_FORM_STACK_CLASS}>
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base font-medium leading-snug">
                  {postCreate.hasPendingApproval
                    ? "Onboarding is ready and waiting for approval"
                    : "Tenancy created successfully. If onboarding needs approval, you’ll find it in Approvals."}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" asChild className="bg-indigo-600 text-[#ffffff] hover:bg-indigo-700">
                    <Link href="/dashboard/approvals">Open Approvals</Link>
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Done
                    </Button>
                  </DialogClose>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!postCreate ? (
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
