import { z } from "zod";

import { optionalEmailSchema } from "@/lib/validations/email";

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
  contactEmail: optionalEmailSchema,
  businessAddress: z.string().optional(),
  /** Legacy DB value `friendly_reminder` is accepted; UI may use `friendly_polite`. */
  rentChaserTone: z.enum([
    "professional_firm",
    "friendly_polite",
    "friendly_reminder",
    "formal_legal",
  ]),
  firstChaseDays: preprocessInt(3, 1),
  emailSignoff: z.string().optional(),
  includePaymentPlan: z.boolean().default(true),
  /** Display name for Resend From header (platform address from env). */
  emailFromName: z.string().optional(),
  autoSendRentChaser: z.boolean().default(false),
  autoSendMaintenanceUpdates: z.boolean().default(false),
  autoSendOnboardingEmails: z.boolean().default(false),
  autoSendLeadUpdates: z.boolean().default(false),
  rentChaserInstructions: z.string().optional(),
  minLeadScore: preprocessInt(70, 1, 100),
  /** Server actions may omit empty arrays; default keeps parse resilient. */
  preferredSources: z.array(sourceEnum).default([]),
  disqualifyNoMovein: z.boolean().default(false),
  leadQualifierCriteria: z.string().optional(),
  referencingAgencyName: z.string().optional(),
  referencingAgencyEmail: optionalEmailSchema,
  referencingAgencyNotes: z.string().optional(),
  autoSendReferencingEmails: z.boolean().default(false),
});

export type UserSettingsInput = z.output<typeof userSettingsSchema>;

