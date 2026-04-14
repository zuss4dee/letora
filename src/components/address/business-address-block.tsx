"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import { AddressMapPicker } from "./address-map-picker";
import { isGoogleMapsConfigured } from "./load-google-maps";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
};

export function BusinessAddressBlock({ id, value, onChange, error, className }: Props) {
  const uid = useId();
  const manualToggleId = `${uid}-biz-manual`;
  const mapsOk = isGoogleMapsConfigured();
  const [manualOnly, setManualOnly] = useState(!mapsOk);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>Business address</Label>
        {mapsOk ? (
          <div className="flex items-center gap-2">
            <input
              id={manualToggleId}
              type="checkbox"
              checked={manualOnly}
              onChange={(e) => setManualOnly(e.target.checked)}
              className="size-3.5 rounded border-input accent-primary"
            />
            <Label htmlFor={manualToggleId} className="cursor-pointer text-xs font-normal text-muted-foreground">
              Add address manually
            </Label>
          </div>
        ) : null}
      </div>

      {!manualOnly && mapsOk ? (
        <AddressMapPicker
          onResolved={(v) => onChange(v.formattedAddress)}
          className="pb-1"
        />
      ) : null}

      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Full business address (as it should appear on correspondence)"
        className="min-h-[100px] resize-y"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
