import { z } from "zod";

import { optionalEmailSchema } from "@/lib/validations/email";

const sourceEnum = z.enum(["Rightmove", "Zoopla", "OnTheMarket", "Referral", "Direct"]);

export const chaseToneEnum = z.enum(["friendly", "firm", "formal", "legal"]);
export type ChaseTone = z.output<typeof chaseToneEnum>;

export const themePreferenceEnum = z.enum(["light", "dark", "system"]);
export type ThemePreference = z.output<typeof themePreferenceEnum>;

export const digestDayEnum = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type DigestDay = z.output<typeof digestDayEnum>;

function preprocessInt(fallback: number, min: number, max?: number) {
  return z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return fallback;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? fallback : n;
  }, max !== undefined ? z.number().int().min(min).max(max) : z.number().int().min(min));
}

export const userSettingsSchema = z.object({
  /** Legacy / agent fields */
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
  preferredSources: z.array(sourceEnum).default([]),
  disqualifyNoMovein: z.boolean().default(false),
  leadQualifierCriteria: z.string().optional(),
  referencingAgencyName: z.string().optional(),
  referencingAgencyEmail: optionalEmailSchema,
  referencingAgencyNotes: z.string().optional(),
  autoSendReferencingEmails: z.boolean().default(false),
});

export type UserSettingsInput = z.output<typeof userSettingsSchema>;

/* -------------------------------------------------------------------------- */
/* Section-scoped schemas — used by the settings panel per-tab Save actions.  */
/* -------------------------------------------------------------------------- */

export const organisationSettingsSchema = z.object({
  orgName: z.string().trim().min(1, "Enter your organisation name.").max(120, "Keep this under 120 characters."),
  orgLogoUrl: z.string().trim().max(500).optional(),
  orgContactEmail: optionalEmailSchema,
  orgPhone: z.string().trim().max(40).optional(),
  orgAddress: z.string().trim().max(500).optional(),
});
export type OrganisationSettingsInput = z.output<typeof organisationSettingsSchema>;

export const profileSettingsSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
});
export type ProfileSettingsInput = z.output<typeof profileSettingsSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });
export type PasswordChangeInput = z.output<typeof passwordChangeSchema>;

export const aiChaseSettingsSchema = z.object({
  chaseTriggerDays: preprocessInt(3, 1, 30),
  chaseMaxPerMonth: preprocessInt(3, 1, 10),
  chaseMinGapDays: preprocessInt(5, 1, 30),
  chaseAllowWeekends: z.boolean().default(false),
  chaseEscalationThreshold: preprocessInt(3, 1, 6),
  chaseTone1: chaseToneEnum.default("friendly"),
  chaseTone2: chaseToneEnum.default("firm"),
  chaseTone3: chaseToneEnum.default("formal"),
  chaseRequireApproval: z.boolean().default(true),
  chaseAiProactive: z.boolean().default(true),
});
export type AiChaseSettingsInput = z.output<typeof aiChaseSettingsSchema>;

export const emailTemplatesSettingsSchema = z.object({
  emailSenderName: z.string().trim().max(120).optional(),
  emailReplyTo: optionalEmailSchema,
  emailChase1Subject: z.string().trim().max(200).optional(),
  emailChase1Body: z.string().max(8000).optional(),
  emailChase2Subject: z.string().trim().max(200).optional(),
  emailChase2Body: z.string().max(8000).optional(),
  emailChase3Subject: z.string().trim().max(200).optional(),
  emailChase3Body: z.string().max(8000).optional(),
});
export type EmailTemplatesSettingsInput = z.output<typeof emailTemplatesSettingsSchema>;

export const notificationSettingsSchema = z.object({
  notifRentOverdue: z.boolean().default(true),
  notifRentOverdueDays: preprocessInt(1, 1, 14),
  notifEscalation: z.boolean().default(true),
  notifApprovalReady: z.boolean().default(true),
  notifApprovalQueueThreshold: preprocessInt(5, 1, 50),
  notifMaintenance: z.boolean().default(true),
  notifWeeklyDigest: z.boolean().default(true),
  notifDigestDay: digestDayEnum.default("mon"),
  notifDigestTime: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM format.")
    .default("08:00"),
});
export type NotificationSettingsInput = z.output<typeof notificationSettingsSchema>;

export const appearanceSettingsSchema = z.object({
  themePreference: themePreferenceEnum.default("system"),
});
export type AppearanceSettingsInput = z.output<typeof appearanceSettingsSchema>;
