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
  DIALOG_SINGLE_COLUMN_CLASS,
} from "@/lib/ui/dialog-form";
import type { PropertyPickListItem } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

const LABEL_CLASS = "text-[10px] uppercase tracking-widest font-semibold text-[#888888]";
const INPUT_CLASS = "bg-background dark:bg-[#0B0B0B] border border-border dark:border-[#333333] text-[11px] text-white py-2 px-3 focus-visible:ring-0 focus-visible:border-white rounded-none placeholder-[#444748] w-full transition-colors font-mono";


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
          <Button className="bg-white text-[#161616] py-2 font-bold text-[10px] tracking-wider uppercase active:scale-[0.98] transition-transform rounded-none">
            Add Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={cn(DIALOG_SINGLE_COLUMN_CLASS, "bg-background dark:bg-[#161616] border border-border dark:border-[#282828] text-white rounded-none p-0 gap-0 shadow-2xl")}>
        <div className="p-5 border-b border-border dark:border-[#282828] bg-background dark:bg-[#1A1A1A]">
          <DialogTitle className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Add lead</DialogTitle>
          <DialogDescription className="text-[10px] text-[#888888] mt-1 tracking-wide">CREATE A NEW PROSPECTIVE TENANT LEAD</DialogDescription>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-5 flex flex-col gap-4">
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="lead-name" className={LABEL_CLASS}>Full name</Label>
              <Input
                id="lead-name"
                className={INPUT_CLASS}
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
                <Label htmlFor="lead-email" className={LABEL_CLASS}>Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  className={INPUT_CLASS}
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
                <Label htmlFor="lead-phone" className={LABEL_CLASS}>Phone</Label>
                <Input
                  id="lead-phone"
                  type="tel"
                  className={INPUT_CLASS}
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
              <Label className={LABEL_CLASS}>Property interest</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={INPUT_CLASS}>
                      <SelectValue placeholder="No specific property" />
                    </SelectTrigger>
                    <SelectContent className="bg-background dark:bg-[#0B0B0B] border-border dark:border-[#333333] text-white rounded-none font-mono text-[11px]">
                      <SelectItem value={LEAD_OPTION_NONE} className="focus:bg-background dark:bg-[#242424] focus:text-white rounded-none">No specific property</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="focus:bg-background dark:bg-[#242424] focus:text-white rounded-none">
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
              <Label className={LABEL_CLASS}>Source</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={INPUT_CLASS}>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="bg-background dark:bg-[#0B0B0B] border-border dark:border-[#333333] text-white rounded-none font-mono text-[11px]">
                      <SelectItem value={LEAD_OPTION_NONE} className="focus:bg-background dark:bg-[#242424] focus:text-white rounded-none">Not specified</SelectItem>
                      {LEAD_SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="focus:bg-background dark:bg-[#242424] focus:text-white rounded-none">
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
                <Label htmlFor="lead-budget" className={LABEL_CLASS}>Budget</Label>
                <Input
                  id="lead-budget"
                  type="number"
                  className={INPUT_CLASS}
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
                  onFocus={(e) => e.target.select()}
                />
                {errors.budget ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.budget.message}
                  </p>
                ) : null}
              </div>
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="lead-move-in" className={LABEL_CLASS}>Move-in date</Label>
                <Input id="lead-move-in" type="date" className={INPUT_CLASS} {...form.register("moveInDate")} />
                {errors.moveInDate ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.moveInDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="lead-notes" className={LABEL_CLASS}>Notes</Label>
              <Textarea
                id="lead-notes"
                className={cn(INPUT_CLASS, "min-h-[80px] resize-none")}
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

          <div className="p-4 border-t border-border dark:border-[#282828] bg-background dark:bg-[#1A1A1A] flex items-center justify-end gap-3 mt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-[#888888] hover:text-white hover:bg-background dark:bg-[#242424] font-bold text-[10px] tracking-wider uppercase rounded-none px-4">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-white text-[#161616] hover:bg-background dark:bg-[#e2e2e2] uppercase text-[10px] font-bold tracking-wider rounded-none px-6">
              {isSubmitting ? "Adding…" : "Add lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
