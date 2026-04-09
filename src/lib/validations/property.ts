import { z } from "zod";

function preprocessNumber(fallback: number) {
  return (val: unknown) => {
    if (val === "" || val === null || val === undefined) return fallback;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? fallback : n;
  };
}

function preprocessOptionalDate() {
  return (val: unknown) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const s = String(val).trim().slice(0, 10);
    return s === "" ? undefined : s;
  };
}

const optionalIsoDate = z.preprocess(
  preprocessOptionalDate(),
  z.union([z.undefined(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
);

export const propertySchema = z.object({
  address: z.string().min(1),
  postcode: z.string().min(1),
  city: z.string().min(1),
  propertyType: z.enum(["Flat", "House", "Semi-detached", "Terraced"]),
  bedrooms: z.preprocess(preprocessNumber(1), z.number().int().min(1).max(10)),
  bathrooms: z.preprocess(preprocessNumber(1), z.number().int().min(1).max(5)),
  monthlyRent: z.preprocess(preprocessNumber(0), z.number().min(0)),
  status: z.enum(["active", "vacant", "maintenance"]),
  hasGasSupply: z.boolean().default(true),
  epcExpiry: optionalIsoDate,
  eicrExpiry: optionalIsoDate,
  gasSafetyExpiry: optionalIsoDate,
});

export type AddPropertyInput = z.output<typeof propertySchema>;

