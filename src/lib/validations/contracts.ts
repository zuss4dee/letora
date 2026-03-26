import { z } from "zod";

/** Normalize empty/NaN from number inputs to 0 before validation. */
const moneyField = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isNaN(n) ? 0 : n;
}, z.number().min(0));

export const createContractSchema = z.object({
  tenantId: z.string().uuid("Select a tenant"),
  propertyId: z.string().uuid("Select a property"),
  contractType: z.enum([
    "Assured Shorthold Tenancy (AST)",
    "Room Rental Agreement",
    "Company Let",
    "Licence Agreement",
  ]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  monthlyRent: moneyField,
  depositAmount: moneyField,
  specialClauses: z.string().optional(),
});

export type CreateContractInput = z.output<typeof createContractSchema>;

