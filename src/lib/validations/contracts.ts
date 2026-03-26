import { z } from "zod";

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
  monthlyRent: z.coerce.number().min(0),
  depositAmount: z.coerce.number().min(0),
  specialClauses: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

