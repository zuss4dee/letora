import { z } from "zod";

export const addTenancySchema = z.object({
  propertyId: z.string().uuid("Select a property"),
  tenantId: z.string().uuid("Select a tenant"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  monthlyRent: z.coerce.number().min(0),
  depositAmount: z.coerce.number().min(0),
});

export type AddTenancyInput = z.infer<typeof addTenancySchema>;

export const logPaymentSchema = z.object({
  rentPaymentId: z.string().uuid().optional(),
  tenancyId: z.string().uuid("Missing tenancy"),
  amountPaid: z.coerce.number().min(0),
  paidOn: z.string().min(1, "Payment date is required"),
  paymentMethod: z.enum(["bank_transfer", "cash", "standing_order", "other"]),
  notes: z.string().optional(),
});

export type LogPaymentInput = z.infer<typeof logPaymentSchema>;

