import { z } from "zod";

export const CONTRACT_TYPE_OPTIONS = [
  "Assured Shorthold Tenancy (AST)",
  "Assured Tenancy",
  "Fixed Term",
  "Periodic",
  "License Agreement",
] as const;

export const addContractSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  contractType: z.enum(CONTRACT_TYPE_OPTIONS),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  monthlyRent: z.coerce.number().positive(),
  depositAmount: z.coerce.number().min(0),
  specialClauses: z.string().optional(),
});

export type AddContractInput = z.infer<typeof addContractSchema>;
