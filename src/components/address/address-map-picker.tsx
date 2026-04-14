"use client";

import { useEffect, useRef, useState } from "react";

import { parseUkAddressFromGoogleComponents } from "@/lib/address/google-geocode-parse";
import { cn } from "@/lib/utils";

import { isGoogleMapsConfigured, loadGoogleMaps } from "./load-google-maps";

export type ResolvedMapAddress = {
  line1: string;
  city: string;
  postcode: string;
  formattedAddress: string;
};

type Props = {
  onResolved: (value: ResolvedMapAddress) => void;
  onMapError?: (message: string) => void;
  className?: string;
  mapClassName?: string;
  searchWrapperClassName?: string;
  searchInputClassName?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
};

const DEFAULT_CENTER = { lat: 53.4808, lng: -2.2426 };

function applyGeocodeResult(
  result: Pick<google.maps.GeocoderResult, "address_components" | "formatted_address"> | null | undefined,
  onResolved: (value: ResolvedMapAddress) => void,
): boolean {
  if (!result?.address_components?.length) return false;
  const parsed = parseUkAddressFromGoogleComponents(
    result.address_components as { long_name: string; short_name: string; types: string[] }[],
  );
  if (!parsed) return false;
  onResolved({
    line1: parsed.line1,
    city: parsed.city,
    postcode: parsed.postcode,
    formattedAddress: result.formatted_address ?? [parsed.line1, parsed.city, parsed.postcode].join(", "),
  });
  return true;
}

export function AddressMapPicker({
  onResolved,
  onMapError,
  className,
  mapClassName,
  searchWrapperClassName,
  searchInputClassName,
  initialCenter = DEFAULT_CENTER,
  initialZoom = 13,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onResolvedRef = useRef(onResolved);
  const onMapErrorRef = useRef(onMapError);
  const [hint, setHint] = useState<string | null>(null);

  onResolvedRef.current = onResolved;
  onMapErrorRef.current = onMapError;

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setHint("Map search needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Use manual address entry below.");
      onMapErrorRef.current?.("Maps API key not configured");
      return;
    }

    let cancelled = false;

    void loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current || !searchRef.current) return;

        const center = { ...initialCenter };

        const map = new g.maps.Map(mapRef.current, {
          center,
          zoom: initialZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const marker = new g.maps.Marker({
          map,
          position: center,
          draggable: true,
        });

        const geocoder = new g.maps.Geocoder();

        function geocodeLatLng(latLng: google.maps.LatLng) {
          geocoder.geocode({ location: latLng }, (results, status) => {
            if (cancelled) return;
            if (status !== "OK" || !results?.[0]) {
              setHint("Could not resolve that spot — try nearby or enter the address manually.");
              onMapErrorRef.current?.("Geocode failed");
              return;
            }
            if (applyGeocodeResult(results[0], onResolvedRef.current)) {
              setHint(null);
            } else {
              setHint("Pick a point closer to a street address, or type the address manually.");
            }
          });
        }

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          geocodeLatLng(e.latLng);
        });

        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) geocodeLatLng(p);
        });

        const autocomplete = new g.maps.places.Autocomplete(searchRef.current, {
          fields: ["geometry", "address_components", "formatted_address"],
          types: ["address"],
          componentRestrictions: { country: ["gb"] },
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) {
            setHint("Choose a suggestion from the list, or click the map.");
            return;
          }
          map.panTo(place.geometry.location);
          map.setZoom(17);
          marker.setPosition(place.geometry.location);
          if (
            place.address_components?.length &&
            applyGeocodeResult(
              {
                address_components: place.address_components,
                formatted_address: place.formatted_address ?? "",
              },
              onResolvedRef.current,
            )
          ) {
            setHint(null);
            return;
          }
          geocodeLatLng(place.geometry.location);
        });
      })
      .catch(() => {
        if (!cancelled) {
          const msg = "Could not load Google Maps.";
          setHint(msg);
          onMapErrorRef.current?.(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  if (!isGoogleMapsConfigured()) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)} role="status">
        Add a Google Maps API key to pick an address on the map, or use manual entry below.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("relative", searchWrapperClassName)}>
        <label htmlFor="address-map-search" className="sr-only">
          Search for an address
        </label>
        <input
          ref={searchRef}
          id="address-map-search"
          type="text"
          autoComplete="off"
          placeholder="Search address or postcode…"
          className={cn(
            "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
            searchInputClassName,
          )}
        />
      </div>
      <div
        ref={mapRef}
        className={cn("h-[200px] w-full overflow-hidden rounded-md border border-border bg-muted/30", mapClassName)}
        role="application"
        aria-label="Map — click to set property location"
      />
      {hint ? (
        <p className="text-xs text-muted-foreground" role="status">
          {hint}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Type in the search box for suggestions, click the map, or use the street field below — suggestions appear as you type
          when a Maps key is configured.
        </p>
      )}
    </div>
  );
}
