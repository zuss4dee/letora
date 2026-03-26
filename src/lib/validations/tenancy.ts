import { z } from "zod";

const moneyField = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isNaN(n) ? 0 : n;
}, z.number().min(0));

export const addTenancySchema = z.object({
  propertyId: z.string().uuid("Select a property"),
  tenantId: z.string().uuid("Select a tenant"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  monthlyRent: moneyField,
  depositAmount: moneyField,
});

export type AddTenancyInput = z.output<typeof addTenancySchema>;

export const logPaymentSchema = z.object({
  rentPaymentId: z.string().uuid().optional(),
  tenancyId: z.string().uuid("Missing tenancy"),
  amountPaid: moneyField,
  paidOn: z.string().min(1, "Payment date is required"),
  paymentMethod: z.enum(["bank_transfer", "cash", "standing_order", "other"]),
  notes: z.string().optional(),
});

export type LogPaymentInput = z.output<typeof logPaymentSchema>;

