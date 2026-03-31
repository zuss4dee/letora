import { z } from "zod";

const sourceEnum = z.enum(["Rightmove", "Zoopla", "OnTheMarket", "Referral", "Direct"]);

function preprocessInt(fallback: number, min: number, max?: number) {
  return z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return fallback;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? fallback : n;
  }, max !== undefined ? z.number().int().min(min).max(max) : z.number().int().min(min));
}

export const userSettingsSchema = z.object({
  businessName: z.string().optional(),
  landlordName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").or(z.literal("")),
  businessAddress: z.string().optional(),
  rentChaserTone: z.enum(["professional_firm", "friendly_reminder", "formal_legal"]),
  firstChaseDays: preprocessInt(3, 1, 30),
  emailSignoff: z.string().optional(),
  includePaymentPlan: z.boolean(),
  /** Display name for Resend From header (platform address from env). */
  emailFromName: z.string().optional(),
  autoSendRentChaser: z.boolean().default(false),
  autoSendMaintenanceUpdates: z.boolean().default(false),
  autoSendOnboardingEmails: z.boolean().default(false),
  autoSendLeadUpdates: z.boolean().default(false),
  rentChaserInstructions: z.string().optional(),
  minLeadScore: preprocessInt(70, 0, 100),
  preferredSources: z.array(sourceEnum),
  disqualifyNoMovein: z.boolean(),
  leadQualifierCriteria: z.string().optional(),
});

export type UserSettingsInput = z.output<typeof userSettingsSchema>;

