import { z } from "zod";

export const tenantSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  /** Omit or leave empty when unknown — stored as null in the database. */
  dateOfBirth: z.string().optional(),
  rightToRentStatus: z.enum(["pending", "verified", "failed"]),
});

export type AddTenantInput = z.infer<typeof tenantSchema>;

/** Profile edits: date of birth may be cleared in the UI. */
export const tenantUpdateSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  dateOfBirth: z.string().optional(),
  rightToRentStatus: z.enum(["pending", "verified", "failed"]),
});

export type UpdateTenantInput = z.infer<typeof tenantUpdateSchema>;

