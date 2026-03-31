"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addContract } from "@/lib/actions/contracts";
import {
  addContractSchema,
  CONTRACT_TYPE_OPTIONS,
  type AddContractInput,
} from "@/lib/validations/contracts";

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

export function NewContractDialog({
  tenants,
  properties,
}: {
  tenants: Array<{ id: string; label: string }>;
  properties: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddContractInput>(
    () => ({
      tenantId: tenants[0]?.id ?? "",
      propertyId: properties[0]?.id ?? "",
      contractType: CONTRACT_TYPE_OPTIONS[0],
      startDate: "",
      endDate: "",
      monthlyRent: 1,
      depositAmount: 0,
      specialClauses: "",
    }),
    [tenants, properties],
  );

  const form = useForm<AddContractInput>({
    resolver: zodResolver(addContractSchema) as Resolver<AddContractInput>,
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;
  const disabled = tenants.length === 0 || properties.length === 0;

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
      setOpen(false);
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create contract");
    }
  }

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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create contract</DialogTitle>
          <DialogDescription>
            Draft a tenancy agreement. New contracts are saved as draft until you activate them.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tenant</Label>
              <Select
                value={form.watch("tenantId")}
                onValueChange={(v) => form.setValue("tenantId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Property</Label>
              <Select
                value={form.watch("propertyId")}
                onValueChange={(v) => form.setValue("propertyId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Contract Type</Label>
            <Select
              value={form.watch("contractType")}
              onValueChange={(v) =>
                form.setValue("contractType", v as AddContractInput["contractType"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...form.register("endDate")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="monthlyRent">Monthly Rent (£)</Label>
              <Input
                id="monthlyRent"
                type="number"
                min={0}
                step="1"
                {...form.register("monthlyRent", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositAmount">Deposit Amount (£)</Label>
              <Input
                id="depositAmount"
                type="number"
                min={0}
                step="1"
                {...form.register("depositAmount", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="specialClauses">Special Clauses</Label>
            <Textarea
              id="specialClauses"
              placeholder="Optional special clauses and terms."
              {...form.register("specialClauses")}
            />
          </div>

          {submitError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Saving…" : "Create contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
