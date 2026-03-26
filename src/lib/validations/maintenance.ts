import { z } from "zod";

export const maintenanceRequestSchema = z.object({
  propertyId: z.string().uuid("Select a property"),
  tenantId: z.string().uuid("Select a tenant"),
  title: z.string().min(2, "Issue title is required"),
  description: z.string().min(5, "Description is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export type AddMaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

