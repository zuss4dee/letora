"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";

import { addTenant } from "@/lib/actions/tenants";
import { type AddTenantInput, tenantSchema } from "@/lib/validations/tenant";
import { cn } from "@/lib/utils";

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

const labelClassName =
  "font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-500";

const controlClassName =
  "h-8 w-full rounded-[2px] border-zinc-300 bg-background text-sm text-zinc-900 shadow-none transition-colors placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/25 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus-visible:border-zinc-500 dark:focus-visible:ring-zinc-500/20";

const selectTriggerClassName =
  "h-8 w-full min-w-0 rounded-[2px] border-zinc-300 bg-background shadow-none dark:border-zinc-700 dark:bg-zinc-900/50";

export function AddTenantDialog({ trigger }: { trigger?: ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);

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
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitError(null);
    try {
      const result = await addTenant(values);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      form.reset(defaultValues);
      setOpen(false);
      router.refresh();
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-[2px] bg-white px-3 text-[11px] font-semibold text-zinc-900 shadow-none hover:bg-zinc-200",
              "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[2px] border border-border bg-background p-0 text-sm shadow-[0_24px_48px_rgba(1,105,111,0.06)] ring-0",
          "dark:border-zinc-800 dark:bg-[#1A1A1A] dark:shadow-[0_24px_48px_rgba(0,0,0,0.45)]",
          "sm:max-w-[480px]",
        )}
      >
        <DialogHeader className="space-y-2 border-b border-zinc-200/70 px-6 py-5 text-left dark:border-zinc-800">
          <DialogTitle className="font-[family-name:var(--font-inter)] text-lg font-semibold tracking-[-0.01em] text-zinc-900 dark:text-white">
            Add tenant
          </DialogTitle>
          <DialogDescription className="font-[family-name:var(--font-inter)] text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Create a tenant profile. Use a real email so rent and maintenance notices can be sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tn-name" className={labelClassName}>
                Full name
              </Label>
              <Input
                id="tn-name"
                className={cn(controlClassName)}
                placeholder="e.g. Ava Johnson"
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div className="grid w-full min-w-0 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tn-email" className={labelClassName}>
                  Email
                </Label>
                <Input
                  id="tn-email"
                  className={cn(controlClassName)}
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tn-phone" className={labelClassName}>
                  Phone
                </Label>
                <Input
                  id="tn-phone"
                  className={cn(controlClassName)}
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

            <div className="grid w-full min-w-0 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tn-dob" className={labelClassName}>
                  Date of birth (optional)
                </Label>
                <Input
                  id="tn-dob"
                  className={cn(controlClassName)}
                  type="date"
                  {...form.register("dateOfBirth")}
                />
                {form.formState.errors.dateOfBirth?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.dateOfBirth.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tn-rtr" className={labelClassName}>
                  Right to Rent
                </Label>
                <Select
                  value={form.watch("rightToRentStatus")}
                  onValueChange={(v) =>
                    form.setValue("rightToRentStatus", v as AddTenantInput["rightToRentStatus"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="tn-rtr" className={cn(selectTriggerClassName)}>
                    <SelectValue placeholder="Verification status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[2px] border-zinc-200 bg-background dark:border-zinc-800 dark:bg-[#1A1A1A]">
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
              <p className="rounded-[2px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:border-red-500/25 dark:text-red-400">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200/70 px-6 py-4 dark:border-zinc-800">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-8 rounded-[2px] border-zinc-300 bg-background px-4 text-[11px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100",
                  "dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/80",
                )}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "h-8 rounded-[2px] border-0 bg-white px-4 text-[11px] font-semibold text-zinc-900 shadow-none hover:bg-zinc-200",
                "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
              )}
            >
              {isSubmitting ? "Adding…" : "Add tenant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
