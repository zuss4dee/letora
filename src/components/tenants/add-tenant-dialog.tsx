"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";

import { addTenant } from "@/lib/actions/tenants";
import { type AddTenantInput, tenantSchema } from "@/lib/validations/tenant";
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

export function AddTenantDialog({ trigger }: { trigger?: ReactElement }) {
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
        {trigger ?? (
          <Button className="rounded-sm bg-gradient-to-br from-[#C9C6C5] to-[#474646] font-[family-name:var(--font-inter)] text-[#414040] hover:brightness-110">
            Add tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add tenant</DialogTitle>
          <DialogDescription>
            Create a tenant profile. Use a real email so rent and maintenance notices can be sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="tn-name">Full name</Label>
              <Input
                id="tn-name"
                className="w-full"
                placeholder="e.g. Ava Johnson"
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="tn-email">Email</Label>
                <Input
                  id="tn-email"
                  className="w-full"
                  type="email"
                  placeholder="e.g. ava.johnson@email.com"
                  {...form.register("email")}
                />
                {form.formState.errors.email?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="tn-phone">Phone</Label>
                <Input
                  id="tn-phone"
                  className="w-full"
                  placeholder="e.g. +44 7700 900123"
                  {...form.register("phone")}
                />
                {form.formState.errors.phone?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="tn-dob">Date of birth</Label>
                <Input id="tn-dob" className="w-full" type="date" {...form.register("dateOfBirth")} />
                {form.formState.errors.dateOfBirth?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.dateOfBirth.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="tn-rtr">Right to Rent</Label>
                <Select
                  value={form.watch("rightToRentStatus")}
                  onValueChange={(v) =>
                    form.setValue("rightToRentStatus", v as AddTenantInput["rightToRentStatus"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="tn-rtr" className="w-full">
                    <SelectValue placeholder="Verification status" />
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
          </div>

          <div className={dialogFormFooterClass()}>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add tenant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
