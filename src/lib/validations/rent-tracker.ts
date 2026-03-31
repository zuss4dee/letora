import { z } from "zod";

export const addRentPaymentSchema = z.object({
  tenancyId: z.string().uuid(),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

export type AddRentPaymentInput = z.infer<typeof addRentPaymentSchema>;
