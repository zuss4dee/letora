import { z } from "zod";

const sourceEnum = z.enum(["Rightmove", "Zoopla", "OnTheMarket", "Referral", "Direct"]);

export const userSettingsSchema = z.object({
  businessName: z.string().optional(),
  landlordName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").or(z.literal("")),
  businessAddress: z.string().optional(),
  rentChaserTone: z.enum(["professional_firm", "friendly_polite", "formal_legal"]),
  firstChaseDays: z.coerce.number().int().min(1),
  emailSignoff: z.string().optional(),
  includePaymentPlan: z.boolean(),
  rentChaserInstructions: z.string().optional(),
  minLeadScore: z.coerce.number().int().min(1).max(100),
  preferredSources: z.array(sourceEnum),
  disqualifyNoMovein: z.boolean(),
  leadQualifierCriteria: z.string().optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

