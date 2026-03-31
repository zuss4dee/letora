"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addTenancy } from "@/lib/actions/tenancies";
import { type AddTenancyInput, addTenancySchema } from "@/lib/validations/tenancy";

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

export function AddTenancyDialog({
  properties,
  tenants,
}: {
  properties: Array<{ id: string; label: string }>;
  tenants: Array<{ id: string; label: string }>;
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
        <Button
          className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
          disabled={disabled}
        >
          Add Tenancy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add tenancy</DialogTitle>
          <DialogDescription>
            Link a tenant to a property and set the rent terms.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Property</Label>
              <Select
                value={form.watch("propertyId")}
                onValueChange={(v) =>
                  form.setValue("propertyId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select property" />
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

            <div className="grid gap-2">
              <Label>Tenant</Label>
              <Select
                value={form.watch("tenantId")}
                onValueChange={(v) =>
                  form.setValue("tenantId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tenant" />
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" {...form.register("endDate")} />
              {form.formState.errors.endDate?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.endDate.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="moveInDate">Move-in date (optional)</Label>
            <Input id="moveInDate" type="date" {...form.register("moveInDate")} />
            <p className="text-xs text-muted-foreground">
              If left blank, onboarding and reminders use the tenancy start date.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="monthlyRent">Monthly rent (£)</Label>
              <Input
                id="monthlyRent"
                type="number"
                min={0}
                step="1"
                {...form.register("monthlyRent", { valueAsNumber: true })}
              />
              {form.formState.errors.monthlyRent?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.monthlyRent.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositAmount">Deposit amount (£)</Label>
              <Input
                id="depositAmount"
                type="number"
                min={0}
                step="1"
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

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Adding..." : "Add tenancy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

