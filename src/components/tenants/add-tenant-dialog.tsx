"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { addTenant } from "@/lib/actions/tenants";
import { type AddTenantInput, tenantSchema } from "@/lib/validations/tenant";

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

export function AddTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddTenantInput>(
    () => ({
      fullName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      rightToRentStatus: "pending",
    }),
    [],
  );

  const form = useForm<AddTenantInput>({
    resolver: zodResolver(tenantSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: AddTenantInput) {
    setSubmitError(null);
    const result = await addTenant(values);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    form.reset(defaultValues);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300">
          Add Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add tenant</DialogTitle>
          <DialogDescription>Add a tenant profile to your portfolio.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" placeholder="Ava Johnson" {...form.register("fullName")} />
            {form.formState.errors.fullName?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="ava@example.com" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+44 7700 900123" {...form.register("phone")} />
              {form.formState.errors.phone?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
              {form.formState.errors.dateOfBirth?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.dateOfBirth.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Right to Rent</Label>
              <Select
                value={form.watch("rightToRentStatus")}
                onValueChange={(v) =>
                  form.setValue("rightToRentStatus", v as AddTenantInput["rightToRentStatus"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.rightToRentStatus?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.rightToRentStatus.message}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

