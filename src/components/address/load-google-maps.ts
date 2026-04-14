import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let loadPromise: Promise<typeof google> | null = null;

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

/**
 * Loads Maps + Places libraries once (client-only).
 * Uses the functional API from `@googlemaps/js-api-loader` v2.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      setOptions({ key, v: "weekly" });
      await importLibrary("maps");
      await importLibrary("places");
      return google;
    })();
  }
  return loadPromise;
}
