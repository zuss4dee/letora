"use client";

import { useCallback, useId, useState } from "react";
import type { FieldErrors, Path, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { DIALOG_FIELD_CLASS } from "@/lib/ui/dialog-form";
import { cn } from "@/lib/utils";

import { AddressMapPicker } from "./address-map-picker";
import { isGoogleMapsConfigured } from "./load-google-maps";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddressFields = {
  address: string;
  postcode: string;
  city: string;
};

type Props<T extends AddressFields> = {
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  errors: FieldErrors<T>;
  fieldIds: { address: string; postcode: string; city: string };
  /** When false, map + search shown by default (if API key present). */
  defaultManual?: boolean;
  className?: string;
};

export function PropertyAddressFormSection<T extends AddressFields>({
  register,
  setValue,
  errors,
  fieldIds,
  defaultManual = false,
  className,
}: Props<T>) {
  const uid = useId();
  const manualId = `${uid}-manual`;
  const mapsAvailable = isGoogleMapsConfigured();
  const [manualOnly, setManualOnly] = useState(() => defaultManual || !mapsAvailable);

  const applyResolved = useCallback(
    (r: { line1: string; city: string; postcode: string }) => {
      setValue("address" as Path<T>, r.line1 as never, { shouldValidate: true, shouldDirty: true });
      setValue("city" as Path<T>, r.city as never, { shouldValidate: true, shouldDirty: true });
      setValue("postcode" as Path<T>, r.postcode as never, { shouldValidate: true, shouldDirty: true });
    },
    [setValue],
  );

  const errAddr = errors.address?.message as string | undefined;
  const errPc = errors.postcode?.message as string | undefined;
  const errCity = errors.city?.message as string | undefined;

  return (
    <div className={cn("space-y-4", className)}>
      {mapsAvailable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Property location</p>
          <div className="flex items-center gap-2">
            <input
              id={manualId}
              type="checkbox"
              checked={manualOnly}
              onChange={(e) => setManualOnly(e.target.checked)}
              className="size-3.5 rounded border-input accent-[#BD9952]"
            />
            <Label htmlFor={manualId} className="cursor-pointer text-xs font-normal text-muted-foreground">
              Add address manually
            </Label>
          </div>
        </div>
      ) : null}

      {!manualOnly && mapsAvailable ? (
        <AddressMapPicker
          onResolved={(v) => applyResolved({ line1: v.line1, city: v.city, postcode: v.postcode })}
        />
      ) : null}

      <div className={DIALOG_FIELD_CLASS}>
        <Label htmlFor={fieldIds.address}>Street address</Label>
        <Input id={fieldIds.address} className="w-full" {...register("address" as Path<T>)} />
        {errAddr ? <p className="text-xs text-red-600 dark:text-red-400">{errAddr}</p> : null}
      </div>

      <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
        <div className={DIALOG_FIELD_CLASS}>
          <Label htmlFor={fieldIds.postcode}>Postcode</Label>
          <Input id={fieldIds.postcode} className="w-full" {...register("postcode" as Path<T>)} />
          {errPc ? <p className="text-xs text-red-600 dark:text-red-400">{errPc}</p> : null}
        </div>
        <div className={DIALOG_FIELD_CLASS}>
          <Label htmlFor={fieldIds.city}>City</Label>
          <Input id={fieldIds.city} className="w-full" {...register("city" as Path<T>)} />
          {errCity ? <p className="text-xs text-red-600 dark:text-red-400">{errCity}</p> : null}
        </div>
      </div>

      {manualOnly || !mapsAvailable ? null : (
        <p className="text-[11px] text-muted-foreground">
          You can still edit street, postcode, and city after using the map.
        </p>
      )}
    </div>
  );
}
