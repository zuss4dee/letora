/**
 * Normalise Google Geocoder / Places `address_components` into Letora property fields.
 * Works with UK-heavy portfolios; falls back sensibly when a field is missing.
 */

export type GeocoderComponentLike = {
  long_name: string;
  short_name: string;
  types: string[];
};

export function parseUkAddressFromGoogleComponents(
  components: GeocoderComponentLike[],
): { line1: string; city: string; postcode: string } | null {
  if (!components?.length) return null;

  let subpremise = "";
  let streetNumber = "";
  let route = "";
  let postcode = "";
  let city = "";

  for (const c of components) {
    const t = c.types;
    if (t.includes("subpremise")) subpremise = c.long_name;
    if (t.includes("street_number")) streetNumber = c.long_name;
    if (t.includes("route")) route = c.long_name;
    if (t.includes("postal_code")) postcode = c.long_name;
    if (t.includes("postal_town")) city = c.long_name;
    else if (!city && t.includes("locality")) city = c.long_name;
  }

  if (!city) {
    for (const c of components) {
      if (c.types.includes("administrative_area_level_2") && !city) {
        city = c.long_name;
        break;
      }
    }
  }

  const lineParts = [subpremise, streetNumber, route].filter(Boolean);
  const line1 = lineParts.join(" ").replace(/\s+/g, " ").trim();
  const pc = postcode.replace(/\s+/g, " ").trim();

  if (!line1 || !pc) return null;
  if (!city) city = "UK";

  return { line1, city: city.trim(), postcode: pc };
}
