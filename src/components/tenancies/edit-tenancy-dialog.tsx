"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { updateTenancy } from "@/lib/actions/tenancies";
import { cn } from "@/lib/utils";
import { type UpdateTenancyInput, updateTenancySchema } from "@/lib/validations/tenancy";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import { TENANCY_OUTLINE_BTN, TENANCY_PRIMARY_BTN } from "@/components/tenancies/tenancy-letora-surfaces";

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

export type EditTenancyInitial = {
  startDate: string | null;
  endDate: string | null;
  moveInDate: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
  status: string | null;
};

function normalizeStatus(status: string | null): UpdateTenancyInput["status"] {
  if (status === "ended" || status === "pending") return status;
  return "active";
}

function toFormValues(initial: EditTenancyInitial): UpdateTenancyInput {
  return {
    startDate: initial.startDate ?? "",
    endDate: initial.endDate ?? "",
    moveInDate: initial.moveInDate?.trim() ? initial.moveInDate : "",
    monthlyRent: initial.monthlyRent ?? 0,
    depositAmount: initial.depositAmount ?? 0,
    status: normalizeStatus(initial.status),
  };
}

export function EditTenancyDialog({
  tenancyId,
  userId,
  initial,
  triggerLabel = "Edit",
  triggerClassName,
}: {
  tenancyId: string;
  userId: string;
  initial: EditTenancyInitial;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo(() => toFormValues(initial), [initial]);

  const form = useForm<UpdateTenancyInput>({
    resolver: zodResolver(updateTenancySchema) as Resolver<UpdateTenancyInput>,
    defaultValues,
    mode: "onSubmit",
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toFormValues(initial));
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: UpdateTenancyInput) {
    setSubmitError(null);
    const result = await updateTenancy(tenancyId, values, userId);
    if (!result.success) {
      setSubmitError(result.error ?? "Could not save");
      return;
    }
    toast.success("Tenancy updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(TENANCY_OUTLINE_BTN, "h-9 px-4", triggerClassName)}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Edit tenancy</DialogTitle>
          <DialogDescription>
            Update dates, rent, deposit, and status. Tenant and property cannot be changed here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor={`start-${tenancyId}`}>Start date</Label>
                <Input
                  id={`start-${tenancyId}`}
                  className="w-full"
                  type="date"
                  {...form.register("startDate")}
                />
                {form.formState.errors.startDate?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.startDate.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor={`end-${tenancyId}`}>End date</Label>
                <Input
                  id={`end-${tenancyId}`}
                  className="w-full"
                  type="date"
                  {...form.register("endDate")}
                />
                {form.formState.errors.endDate?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.endDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor={`move-${tenancyId}`}>Move-in date (optional)</Label>
              <Input
                id={`move-${tenancyId}`}
                className="w-full"
                type="date"
                {...form.register("moveInDate")}
              />
              <p className="text-xs text-muted-foreground">
                If left blank, onboarding uses the tenancy start date.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor={`rent-${tenancyId}`}>Monthly rent (£)</Label>
                <Input
                  id={`rent-${tenancyId}`}
                  className="w-full"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 1200"
                  {...form.register("monthlyRent", { valueAsNumber: true })}
                  onFocus={(e) => e.target.select()}
                />
                {form.formState.errors.monthlyRent?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.monthlyRent.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor={`dep-${tenancyId}`}>Deposit (£)</Label>
                <Input
                  id={`dep-${tenancyId}`}
                  className="w-full"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 1200"
                  {...form.register("depositAmount", { valueAsNumber: true })}
                  onFocus={(e) => e.target.select()}
                />
                {form.formState.errors.depositAmount?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.depositAmount.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor={`st-${tenancyId}`}>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as UpdateTenancyInput["status"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id={`st-${tenancyId}`} className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submitError ? (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className={dialogFormFooterClass()}>
            <DialogClose asChild>
              <Button type="button" variant="outline" className={cn(TENANCY_OUTLINE_BTN, "h-9 px-4")}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className={cn(TENANCY_PRIMARY_BTN, "px-6")}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
