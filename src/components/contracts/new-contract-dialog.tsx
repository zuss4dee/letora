"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { createContract } from "@/lib/actions/contracts";
import {
  type CreateContractInput,
  createContractSchema,
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

type SaveMode = "draft" | "sent";

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
  const [saveMode, setSaveMode] = useState<SaveMode>("draft");

  const defaultValues = useMemo<CreateContractInput>(
    () => ({
      tenantId: tenants[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      propertyId: properties[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      contractType: "Assured Shorthold Tenancy (AST)",
      startDate: "",
      endDate: "",
      monthlyRent: 0,
      depositAmount: 0,
      specialClauses: "",
    }),
    [tenants, properties],
  );

  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;
  const disabled = tenants.length === 0 || properties.length === 0;

  async function onSubmit(values: CreateContractInput) {
    setSubmitError(null);
    const result = await createContract(values, saveMode);
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
            Draft a tenancy agreement and save as draft or send to tenant.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
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
                onValueChange={(v) =>
                  form.setValue("propertyId", v, { shouldValidate: true })
                }
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
                form.setValue("contractType", v as CreateContractInput["contractType"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Assured Shorthold Tenancy (AST)">
                  Assured Shorthold Tenancy (AST)
                </SelectItem>
                <SelectItem value="Room Rental Agreement">Room Rental Agreement</SelectItem>
                <SelectItem value="Company Let">Company Let</SelectItem>
                <SelectItem value="Licence Agreement">Licence Agreement</SelectItem>
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
              <Input id="monthlyRent" type="number" min={0} step="1" {...form.register("monthlyRent")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositAmount">Deposit Amount (£)</Label>
              <Input
                id="depositAmount"
                type="number"
                min={0}
                step="1"
                {...form.register("depositAmount")}
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
            <Button
              type="submit"
              variant="outline"
              disabled={isSubmitting || disabled}
              onClick={() => setSaveMode("draft")}
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || disabled}
              onClick={() => setSaveMode("sent")}
              className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            >
              Send to Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

