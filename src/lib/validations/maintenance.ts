import { z } from "zod";

export const maintenanceRequestSchema = z.object({
  tenancyId: z.string().uuid("Select a tenancy"),
  description: z.string().min(5, "Issue description is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export type AddMaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

export const assignContractorSchema = z.object({
  contractorName: z.string().min(1, "Name is required"),
  contractorEmail: z.string().email("Valid email required"),
});

export type AssignContractorInput = z.infer<typeof assignContractorSchema>;

