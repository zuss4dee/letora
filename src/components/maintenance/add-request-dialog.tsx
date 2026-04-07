"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";

import { addMaintenanceRequest } from "@/lib/actions/maintenance";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import {
  type AddMaintenanceRequestInput,
  maintenanceRequestSchema,
} from "@/lib/validations/maintenance";

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
  tenancies,
  trigger,
}: {
  tenancies: Array<{ id: string; label: string }>;
  trigger?: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<AddMaintenanceRequestInput>(
    () => ({
      tenancyId: tenancies[0]?.id ?? "",
      description: "",
      priority: "medium",
    }),
    [tenancies],
  );

  const form = useForm<AddMaintenanceRequestInput>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;
  const disabled = tenancies.length === 0;

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
        {trigger ?? (
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            disabled={disabled}
          >
            Add Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add maintenance request</DialogTitle>
          <DialogDescription>
            Choose the tenancy (property and tenant). The issue is stored as the description only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="mr-tenancy">Tenancy</Label>
              <Select
                value={form.watch("tenancyId")}
                onValueChange={(v) =>
                  form.setValue("tenancyId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="mr-tenancy" className="w-full">
                  <SelectValue placeholder="Property address · tenant name" />
                </SelectTrigger>
                <SelectContent>
                  {tenancies.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.tenancyId?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.tenancyId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="mr-desc">Issue description</Label>
              <Textarea
                id="mr-desc"
                placeholder="e.g. Gas smell from kitchen since Tuesday; meter is off; windows open."
                className="w-full min-h-[100px]"
                {...form.register("description")}
              />
              {form.formState.errors.description?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.description.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="mr-priority">Priority</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(v) =>
                  form.setValue("priority", v as AddMaintenanceRequestInput["priority"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="mr-priority" className="w-full">
                  <SelectValue placeholder="How urgent is this?" />
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
          </div>

          <div className={dialogFormFooterClass()}>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || disabled}>
              {isSubmitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
