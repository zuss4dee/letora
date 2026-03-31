"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { addProperty } from "@/lib/actions/properties";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddPropertyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    }),
    [],
  );

  const form = useForm<AddPropertyInput>({
    resolver: zodResolver(propertySchema) as Resolver<AddPropertyInput>,
    defaultValues,
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: AddPropertyInput) {
    setSubmitError(null);
    const result = await addProperty(values);
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
          Add Property
        </Button>
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
              {isSubmitting ? "Adding…" : "Add property"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
