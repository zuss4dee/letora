"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { addLead } from "@/lib/actions/leads";
import {
  type AddLeadFormValues,
  addLeadSchema,
  LEAD_OPTION_NONE,
  LEAD_SOURCE_OPTIONS,
} from "@/lib/validations/leads";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import type { PropertyPickListItem } from "@/lib/actions/properties";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { Textarea } from "@/components/ui/textarea";

function defaultFormValues(): AddLeadFormValues {
  return {
    name: "",
    email: "",
    phone: "",
    propertyId: LEAD_OPTION_NONE,
    source: LEAD_OPTION_NONE,
    moveInDate: "",
    notes: "",
    budget: undefined,
  };
}

export function AddLeadDialog({
  properties,
  trigger,
}: {
  properties: PropertyPickListItem[];
  trigger?: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const prevOpenRef = useRef(false);

  const defaultValues = useMemo(() => defaultFormValues(), []);

  const form = useForm<AddLeadFormValues>({
    resolver: zodResolver(addLeadSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      form.reset(defaultFormValues());
    }
    prevOpenRef.current = open;
  }, [open, form]);

  const isSubmitting = form.formState.isSubmitting;
  const { errors } = form.formState;

  async function onSubmit(values: AddLeadFormValues) {
    try {
      await addLead({
        name: values.name,
        email: values.email,
        phone: values.phone,
        propertyId: values.propertyId,
        source: values.source,
        budget: values.budget,
        moveInDate: values.moveInDate,
        notes: values.notes,
      });
      toast.success("Lead added.");
      form.reset(defaultFormValues());
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add lead";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300">
            Add Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>Create a new prospective tenant lead.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="lead-name">Full name</Label>
              <Input
                id="lead-name"
                placeholder="e.g. Sarah Johnson"
                autoComplete="name"
                {...form.register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="e.g. sarah@email.com"
                  autoComplete="email"
                  {...form.register("email")}
                />
                {errors.email ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  type="tel"
                  placeholder="e.g. 07700 900123"
                  autoComplete="tel"
                  {...form.register("phone")}
                />
                {errors.phone ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.phone.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label>Property interest</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No specific property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LEAD_OPTION_NONE}>No specific property</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address?.trim() || "Property"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.propertyId ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.propertyId.message}
                </p>
              ) : null}
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label>Source</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LEAD_OPTION_NONE}>Not specified</SelectItem>
                      {LEAD_SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.source ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.source.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="lead-budget">Budget</Label>
                <Input
                  id="lead-budget"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 950.00"
                  {...form.register("budget", {
                    setValueAs: (v) => {
                      if (v === "" || v === null || v === undefined) return undefined;
                      const n = typeof v === "number" ? v : Number(v);
                      return Number.isFinite(n) && !Number.isNaN(n) ? n : undefined;
                    },
                  })}
                />
                {errors.budget ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.budget.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="lead-move-in">Move-in date</Label>
                <Input id="lead-move-in" type="date" {...form.register("moveInDate")} />
                {errors.moveInDate ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.moveInDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                placeholder="e.g. Looking for 2-bed, flexible on dates"
                rows={4}
                {...form.register("notes")}
              />
              {errors.notes ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.notes.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className={dialogFormFooterClass("mt-4")}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
