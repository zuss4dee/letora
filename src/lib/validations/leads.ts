import { z } from "zod";

export const addLeadSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone is required"),
  propertyId: z.string().uuid("Select a property"),
  moveInDate: z.string().min(1, "Move-in date is required"),
  source: z.enum([
    "Rightmove",
    "Zoopla",
    "OnTheMarket",
    "Referral",
    "Direct",
    "Other",
  ]),
  notes: z.string().optional(),
});

export type AddLeadInput = z.infer<typeof addLeadSchema>;

