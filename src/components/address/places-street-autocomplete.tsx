"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { parseUkAddressFromGoogleComponents } from "@/lib/address/google-geocode-parse";
import { cn } from "@/lib/utils";

import type { ResolvedMapAddress } from "./address-map-picker";
import { isGoogleMapsConfigured, loadGoogleMaps } from "./load-google-maps";

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function applyPlaceComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  formattedAddress: string | undefined,
  onChange: (line1: string) => void,
  onPlaceSelected: (resolved: ResolvedMapAddress) => void,
): boolean {
  if (!components?.length) return false;
  const parsed = parseUkAddressFromGoogleComponents(
    components as { long_name: string; short_name: string; types: string[] }[],
  );
  if (!parsed) return false;
  onChange(parsed.line1);
  onPlaceSelected({
    line1: parsed.line1,
    city: parsed.city,
    postcode: parsed.postcode,
    formattedAddress: formattedAddress ?? [parsed.line1, parsed.city, parsed.postcode].join(", "),
  });
  return true;
}

export function PlacesStreetAutocomplete({
  id: propId,
  value,
  onChange,
  onPlaceSelected,
  onResolveFailed,
  disabled,
  className,
  placeholder = "Start typing an address or postcode…",
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  onPlaceSelected: (resolved: ResolvedMapAddress) => void;
  /** Called when Google returns a place we could not map to UK street / city / postcode. */
  onResolveFailed?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const reactId = useId();
  const id = propId ?? reactId;
  const listboxId = `${id}-listbox`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(value.trim(), 280);

  useEffect(() => {
    if (!isGoogleMapsConfigured() || disabled) {
      setPredictions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (debouncedQuery.length < 2) {
      setPredictions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadGoogleMaps().then((g) => {
      if (cancelled) return;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
      }
      const svc = new g.maps.places.AutocompleteService();
      svc.getPlacePredictions(
        {
          input: debouncedQuery,
          componentRestrictions: { country: ["gb"] },
          types: ["address"],
          sessionToken: sessionTokenRef.current,
        },
        (preds, status) => {
          if (cancelled) return;
          setLoading(false);
          if (status !== g.maps.places.PlacesServiceStatus.OK || !preds?.length) {
            setPredictions([]);
            setOpen(false);
            return;
          }
          setPredictions(preds);
          setOpen(true);
          setHighlight(0);
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, disabled]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const selectPrediction = useCallback(
    (p: google.maps.places.AutocompletePrediction) => {
      if (!isGoogleMapsConfigured()) return;

      void loadGoogleMaps().then((g) => {
        const div = document.createElement("div");
        const places = new g.maps.places.PlacesService(div);
        const token = sessionTokenRef.current ?? undefined;

        const finishSession = () => {
          sessionTokenRef.current = null;
          setOpen(false);
          setPredictions([]);
        };

        places.getDetails(
          {
            placeId: p.place_id,
            fields: ["address_components", "formatted_address", "geometry"],
            sessionToken: token,
          },
          (place, status) => {
            if (status !== g.maps.places.PlacesServiceStatus.OK || !place) {
              onResolveFailed?.();
              return;
            }

            if (applyPlaceComponents(place.address_components, place.formatted_address ?? undefined, onChange, onPlaceSelected)) {
              finishSession();
              return;
            }

            const geo = new g.maps.Geocoder();
            geo.geocode({ placeId: p.place_id }, (results, geoStatus) => {
              const r = results?.[0];
              if (
                geoStatus === "OK" &&
                r &&
                applyPlaceComponents(r.address_components, r.formatted_address ?? undefined, onChange, onPlaceSelected)
              ) {
                finishSession();
                return;
              }
              onResolveFailed?.();
            });
          },
        );
      });
    },
    [onChange, onPlaceSelected, onResolveFailed],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = predictions[highlight];
      if (pick) selectPrediction(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!isGoogleMapsConfigured()) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        placeholder={placeholder}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        className={cn(loading && "pr-9", className)}
      />
      {open && predictions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[200] mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-50 dark:bg-zinc-950 py-1 shadow-xl dark:border-border dark:bg-popover"
        >
          {predictions.map((pred, i) => (
            <li
              key={pred.place_id}
              role="option"
              aria-selected={i === highlight}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-zinc-200 dark:text-popover-foreground",
                i === highlight ? "bg-zinc-200 dark:bg-zinc-800 dark:bg-accent" : "hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-accent/80",
              )}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => selectPrediction(pred)}
            >
              {pred.description}
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? (
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          aria-hidden
        >
          …
        </span>
      ) : null}
    </div>
  );
}
