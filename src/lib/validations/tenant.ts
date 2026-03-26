import { z } from "zod";

export const tenantSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  rightToRentStatus: z.enum(["pending", "verified", "failed"]),
});

export type AddTenantInput = z.infer<typeof tenantSchema>;

