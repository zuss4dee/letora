import { z } from "zod";

export const propertySchema = z.object({
  address: z.string().min(1),
  postcode: z.string().min(1),
  city: z.string().min(1).default("Manchester"),
  propertyType: z.enum(["Flat", "House", "Semi-detached", "Terraced"]),
  bedrooms: z.coerce.number().int().min(1).max(10),
  bathrooms: z.coerce.number().int().min(1).max(5),
  monthlyRent: z.coerce.number().min(0),
  status: z.enum(["active", "vacant", "maintenance"]),
});

export type AddPropertyInput = z.infer<typeof propertySchema>;

