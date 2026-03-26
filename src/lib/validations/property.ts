import { z } from "zod";

function preprocessNumber(fallback: number) {
  return (val: unknown) => {
    if (val === "" || val === null || val === undefined) return fallback;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? fallback : n;
  };
}

export const propertySchema = z.object({
  address: z.string().min(1),
  postcode: z.string().min(1),
  city: z.string().min(1),
  propertyType: z.enum(["Flat", "House", "Semi-detached", "Terraced"]),
  bedrooms: z.preprocess(preprocessNumber(1), z.number().int().min(1).max(10)),
  bathrooms: z.preprocess(preprocessNumber(1), z.number().int().min(1).max(5)),
  monthlyRent: z.preprocess(preprocessNumber(0), z.number().min(0)),
  status: z.enum(["active", "vacant", "maintenance"]),
});

export type AddPropertyInput = z.output<typeof propertySchema>;

