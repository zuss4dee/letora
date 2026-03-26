"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { addMaintenanceRequest } from "@/lib/actions/maintenance";
import {
  type AddMaintenanceRequestInput,
  maintenanceRequestSchema,
} from "@/lib/validations/maintenance";

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

export function AddRequestDialog({
  properties,
  tenants,
}: {
  properties: Array<{ id: string; label: string }>;
  tenants: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddMaintenanceRequestInput>(
    () => ({
      propertyId: properties[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      tenantId: tenants[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      title: "",
      description: "",
      priority: "medium",
    }),
    [properties, tenants],
  );

  const form = useForm<AddMaintenanceRequestInput>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;
  const disabled = properties.length === 0 || tenants.length === 0;

  async function onSubmit(values: AddMaintenanceRequestInput) {
    setSubmitError(null);
    const result = await addMaintenanceRequest(values);
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
          Add Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add maintenance request</DialogTitle>
          <DialogDescription>
            Create a new maintenance request for a property and tenant.
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

          <div className="grid gap-2">
            <Label htmlFor="title">Issue Title</Label>
            <Input id="title" placeholder="e.g. Boiler not working" {...form.register("title")} />
            {form.formState.errors.title?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue, any access notes, and urgency."
              {...form.register("description")}
            />
            {form.formState.errors.description?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select
              value={form.watch("priority")}
              onValueChange={(v) =>
                form.setValue("priority", v as AddMaintenanceRequestInput["priority"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {submitError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Submitting..." : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

