"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addProperty } from "@/lib/actions/properties";
import { PropertyCreatedCompliancePrompt } from "@/components/properties/property-created-compliance-prompt";
import { type AddPropertyInput, propertySchema } from "@/lib/validations/property";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddPropertyDialog({ trigger }: { trigger?: ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [compliancePromptOpen, setCompliancePromptOpen] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [createdHasGasSupply, setCreatedHasGasSupply] = useState(true);

  const defaultValues = useMemo<AddPropertyInput>(
    () => ({
      address: "",
      postcode: "",
      city: "Manchester",
      propertyType: "Flat",
      bedrooms: 2,
      bathrooms: 1,
      monthlyRent: 0,
      status: "active",
      hasGasSupply: true,
      epcExpiry: undefined,
      eicrExpiry: undefined,
      gasSafetyExpiry: undefined,
    }),
    [],
  );

  const form = useForm<AddPropertyInput>({
    resolver: zodResolver(propertySchema) as Resolver<AddPropertyInput>,
    defaultValues,
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  const hasGasSupply = form.watch("hasGasSupply");

  async function onSubmit(values: AddPropertyInput) {
    setSubmitError(null);
    const result = await addProperty(values);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    form.reset(defaultValues);
    setCreatedPropertyId(result.propertyId);
    setCreatedHasGasSupply(result.hasGasSupply);
    setOpen(false);
    setCompliancePromptOpen(true);
    router.refresh();
  }

  function handleCompliancePromptOpenChange(next: boolean) {
    setCompliancePromptOpen(next);
    if (!next) {
      setCreatedPropertyId(null);
    }
  }

  function handleUploadComplianceNow() {
    const id = createdPropertyId;
    if (!id) return;
    setCompliancePromptOpen(false);
    setCreatedPropertyId(null);
    router.push(`/dashboard/compliance?onboard=${id}`);
    router.refresh();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="rounded-sm bg-gradient-to-br from-[#C9C6C5] to-[#474646] font-[family-name:var(--font-inter)] text-[#414040] hover:brightness-110">
            Add property
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={DIALOG_SINGLE_COLUMN_CLASS}>
        <DialogHeader>
          <DialogTitle>Add property</DialogTitle>
          <DialogDescription>
            Add a lettings property. Use the full street address tenants will recognise.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="ap-address">Street address</Label>
              <Input
                id="ap-address"
                className="w-full"
                placeholder="e.g. 12 King Street"
                {...form.register("address")}
              />
              {form.formState.errors.address?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.address.message}
                </p>
              ) : null}
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-postcode">Postcode</Label>
                <Input
                  id="ap-postcode"
                  className="w-full"
                  placeholder="e.g. M1 1AA"
                  {...form.register("postcode")}
                />
                {form.formState.errors.postcode?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.postcode.message}
                  </p>
                ) : null}
              </div>

              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-city">City</Label>
                <Input
                  id="ap-city"
                  className="w-full"
                  placeholder="e.g. Manchester"
                  {...form.register("city")}
                />
                {form.formState.errors.city?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.city.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-type">Property type</Label>
                <Select
                  value={form.watch("propertyType")}
                  onValueChange={(v) =>
                    form.setValue("propertyType", v as AddPropertyInput["propertyType"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="ap-type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flat">Flat</SelectItem>
                    <SelectItem value="House">House</SelectItem>
                    <SelectItem value="Semi-detached">Semi-detached</SelectItem>
                    <SelectItem value="Terraced">Terraced</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.propertyType?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.propertyType.message}
                  </p>
                ) : null}
              </div>

              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", v as AddPropertyInput["status"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="ap-status" className="w-full">
                    <SelectValue placeholder="Letting status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.status?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.status.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-beds">Bedrooms</Label>
                <Input
                  id="ap-beds"
                  className="w-full"
                  type="number"
                  min={1}
                  max={10}
                  {...form.register("bedrooms", { valueAsNumber: true })}
                />
                {form.formState.errors.bedrooms?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.bedrooms.message}
                  </p>
                ) : null}
              </div>

              <div className={DIALOG_FIELD_CLASS}>
                <Label htmlFor="ap-baths">Bathrooms</Label>
                <Input
                  id="ap-baths"
                  className="w-full"
                  type="number"
                  min={1}
                  max={5}
                  {...form.register("bathrooms", { valueAsNumber: true })}
                />
                {form.formState.errors.bathrooms?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {form.formState.errors.bathrooms.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="ap-rent">Monthly rent (£)</Label>
              <Input
                id="ap-rent"
                className="w-full"
                type="number"
                min={0}
                step="1"
                placeholder="e.g. 950"
                {...form.register("monthlyRent", { valueAsNumber: true })}
              />
              {form.formState.errors.monthlyRent?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.monthlyRent.message}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
              <p className="mb-3 font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compliance (optional)
              </p>
              <div className={DIALOG_FIELD_CLASS}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="ap-gas" className="text-sm font-medium">
                      Has gas supply
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      If off, we won&apos;t expect a gas safety (CP12) certificate for this address.
                    </p>
                  </div>
                  <Switch
                    id="ap-gas"
                    checked={hasGasSupply}
                    onCheckedChange={(v) => form.setValue("hasGasSupply", v, { shouldValidate: true })}
                  />
                </div>
              </div>

              <div className="mt-4 grid w-full min-w-0 gap-4 sm:grid-cols-2">
                <div className={DIALOG_FIELD_CLASS}>
                  <Label htmlFor="ap-epc">EPC expiry</Label>
                  <Input id="ap-epc" className="w-full" type="date" {...form.register("epcExpiry")} />
                </div>
                <div className={DIALOG_FIELD_CLASS}>
                  <Label htmlFor="ap-eicr">EICR / electrical expiry</Label>
                  <Input id="ap-eicr" className="w-full" type="date" {...form.register("eicrExpiry")} />
                </div>
              </div>
              {hasGasSupply ? (
                <div className={`${DIALOG_FIELD_CLASS} mt-2`}>
                  <Label htmlFor="ap-gas-exp">Gas safety expiry</Label>
                  <Input id="ap-gas-exp" className="w-full max-w-xs" type="date" {...form.register("gasSafetyExpiry")} />
                </div>
              ) : null}
            </div>

            {submitError ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                <p>{submitError}</p>
                {submitError.includes("property limit") ? (
                  <p className="mt-2 font-[family-name:var(--font-inter)] text-xs font-medium">
                    <Link href="/pricing?limit=properties" className="text-[#BD9952] underline-offset-4 hover:underline">
                      View plans and upgrade
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={dialogFormFooterClass()}>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add property"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <PropertyCreatedCompliancePrompt
      open={compliancePromptOpen}
      hasGasSupply={createdHasGasSupply}
      onOpenChange={handleCompliancePromptOpenChange}
      onUploadNow={handleUploadComplianceNow}
    />
    </>
  );
}
