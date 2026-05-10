"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { updateTenant } from "@/lib/actions/tenants";
import { type UpdateTenantInput, tenantUpdateSchema } from "@/lib/validations/tenant";
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

type Props = {
  tenantId: string;
  initial: UpdateTenantInput;
  triggerLabel?: string;
};

export function EditTenantDialog({ tenantId, initial, triggerLabel = "Edit tenant" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<UpdateTenantInput>(() => initial, [initial]);

  const form = useForm<UpdateTenantInput>({
    resolver: zodResolver(tenantUpdateSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: UpdateTenantInput) {
    setSubmitError(null);
    const result = await updateTenant(tenantId, values);
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
          type="button"
          variant="outline"
          className="border border-zinc-300 bg-white text-zinc-800 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-[#2a2a2a] dark:hover:text-white [&_svg]:text-zinc-600 dark:[&_svg]:text-zinc-400"
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription>Update this tenant profile.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="et-name">Full name</Label>
              <Input id="et-name" className="w-full" {...form.register("fullName")} />
              {form.formState.errors.fullName?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="et-email">Email</Label>
                <Input id="et-email" className="w-full" type="email" {...form.register("email")} />
                {form.formState.errors.email?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="et-phone">Phone</Label>
                <Input id="et-phone" className="w-full" {...form.register("phone")} />
                {form.formState.errors.phone?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="et-dob">Date of birth</Label>
                <Input id="et-dob" className="w-full" type="date" {...form.register("dateOfBirth")} />
                {form.formState.errors.dateOfBirth?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.dateOfBirth.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="et-rtr">Right to Rent</Label>
                <Select
                  // eslint-disable-next-line react-hooks/incompatible-library -- controlled select; RHF watch is intentional
                  value={form.watch("rightToRentStatus")}
                  onValueChange={(v) =>
                    form.setValue("rightToRentStatus", v as UpdateTenantInput["rightToRentStatus"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="et-rtr" className="w-full">
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
              <Button type="button" variant="outline" className="border border-zinc-300 bg-white text-zinc-800 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-[#2a2a2a] dark:hover:text-white [&_svg]:text-zinc-600 dark:[&_svg]:text-zinc-400">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
