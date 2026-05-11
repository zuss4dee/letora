"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { type OnboardingStatus, parseOnboardingStatus } from "@/lib/onboarding/status";
import {
  aiChaseSettingsSchema,
  appearanceSettingsSchema,
  type AiChaseSettingsInput,
  type AppearanceSettingsInput,
  type ChaseTone,
  type DigestDay,
  emailTemplatesSettingsSchema,
  notificationSettingsSchema,
  organisationSettingsSchema,
  profileSettingsSchema,
  type EmailTemplatesSettingsInput,
  type NotificationSettingsInput,
  type OrganisationSettingsInput,
  type ProfileSettingsInput,
  type ThemePreference,
  type UserSettingsInput,
  userSettingsSchema,
} from "@/lib/validations/user-settings";
import { userFacingError } from "@/lib/user-facing-errors";

/**
 * Minimal read for dashboard/onboarding routing. Use this for gates instead of full
 * `getUserSettings()` so a failing wide select (e.g. schema drift) cannot send completed
 * users back to `/onboarding` forever.
 */
export async function getOnboardingStatusForGate(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("onboarding_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getOnboardingStatusForGate]", error.message);
    return null;
  }

  const v = (data as { onboarding_status?: string | null } | null)?.onboarding_status;
  return typeof v === "string" ? v : null;
}

export type UserSettingsRow = UserSettingsInput & {
  id?: string;
  userId?: string;
  /** Present after Stripe Checkout creates or links a customer. */
  stripeCustomerId?: string | null;
  stripeConnectAccountId?: string | null;
  /** Present after Polar Checkout creates or links a customer. */
  polarCustomerId?: string | null;
  polarSubscriptionId?: string | null;
  /** Pipeline: identity → first property → full app. */
  onboardingStatus?: OnboardingStatus;
  onboardingPrimaryGoal?: string | null;
  /** Mercury product tour on dashboard home; persisted in `user_settings.has_seen_tour`. */
  hasSeenTour?: boolean;
  /** When set, dashboard workspace setup checklist is hidden. */
  onboardingSetupReminderDismissedAt?: string | null;
  /** Stripe / Polar subscription display label (e.g. Monthly). */
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPeriodEnd?: string | null;
  subscriptionTrialEnd?: string | null;
  /** Organisation panel */
  orgName?: string;
  orgLogoUrl?: string;
  orgContactEmail?: string;
  orgPhone?: string;
  orgAddress?: string;
  /** Profile panel */
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  /** AI & chasing rules */
  chaseTriggerDays?: number;
  chaseMaxPerMonth?: number;
  chaseMinGapDays?: number;
  chaseAllowWeekends?: boolean;
  chaseEscalationThreshold?: number;
  chaseTone1?: ChaseTone;
  chaseTone2?: ChaseTone;
  chaseTone3?: ChaseTone;
  chaseRequireApproval?: boolean;
  chaseAiProactive?: boolean;
  /** Email templates */
  emailSenderName?: string;
  emailReplyTo?: string;
  emailChase1Subject?: string;
  emailChase1Body?: string;
  emailChase2Subject?: string;
  emailChase2Body?: string;
  emailChase3Subject?: string;
  emailChase3Body?: string;
  /** Notifications */
  notifRentOverdue?: boolean;
  notifRentOverdueDays?: number;
  notifEscalation?: boolean;
  notifApprovalReady?: boolean;
  notifApprovalQueueThreshold?: number;
  notifMaintenance?: boolean;
  notifWeeklyDigest?: boolean;
  notifDigestDay?: DigestDay;
  notifDigestTime?: string;
  /** Appearance */
  themePreference?: ThemePreference;
};

const VALID_TONES: ReadonlyArray<ChaseTone> = ["friendly", "firm", "formal", "legal"];
function parseTone(value: unknown, fallback: ChaseTone): ChaseTone {
  return typeof value === "string" && (VALID_TONES as readonly string[]).includes(value)
    ? (value as ChaseTone)
    : fallback;
}

const VALID_DIGEST_DAYS: ReadonlyArray<DigestDay> = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function parseDigestDay(value: unknown): DigestDay {
  return typeof value === "string" && (VALID_DIGEST_DAYS as readonly string[]).includes(value)
    ? (value as DigestDay)
    : "mon";
}

const VALID_THEMES: ReadonlyArray<ThemePreference> = ["light", "dark", "system"];
function parseTheme(value: unknown): ThemePreference {
  return typeof value === "string" && (VALID_THEMES as readonly string[]).includes(value)
    ? (value as ThemePreference)
    : "system";
}

/** Raw `user_settings` row — wide select for settings panel + legacy columns. */
type UserSettingsRowDb = {
  id: string;
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_connect_account_id?: string | null;
  polar_customer_id?: string | null;
  polar_subscription_id?: string | null;
  business_name?: string | null;
  landlord_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  business_address?: string | null;
  rent_chaser_tone?: string | null;
  first_chase_days?: number | null;
  email_signoff?: string | null;
  include_payment_plan?: boolean | null;
  email_from_name?: string | null;
  auto_send_rent_chaser?: boolean | null;
  auto_send_maintenance_updates?: boolean | null;
  auto_send_onboarding_emails?: boolean | null;
  auto_send_lead_updates?: boolean | null;
  auto_send_referencing_emails?: boolean | null;
  referencing_agency_name?: string | null;
  referencing_agency_email?: string | null;
  referencing_agency_notes?: string | null;
  rent_chaser_instructions?: string | null;
  min_lead_score?: number | null;
  preferred_sources?: string[] | null;
  disqualify_no_movein?: boolean | null;
  lead_qualifier_criteria?: string | null;
  onboarding_status?: string | null;
  onboarding_primary_goal?: string | null;
  onboarding_setup_reminder_dismissed_at?: string | null;
  has_seen_tour?: boolean | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_period_end?: string | null;
  subscription_trial_end?: string | null;
  org_name?: string | null;
  org_logo_url?: string | null;
  org_contact_email?: string | null;
  org_phone?: string | null;
  org_address?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  chase_trigger_days?: number | null;
  chase_max_per_month?: number | null;
  chase_min_gap_days?: number | null;
  chase_allow_weekends?: boolean | null;
  chase_escalation_threshold?: number | null;
  chase_tone_1?: string | null;
  chase_tone_2?: string | null;
  chase_tone_3?: string | null;
  chase_require_approval?: boolean | null;
  chase_ai_proactive?: boolean | null;
  email_sender_name?: string | null;
  email_reply_to?: string | null;
  email_chase1_subject?: string | null;
  email_chase1_body?: string | null;
  email_chase2_subject?: string | null;
  email_chase2_body?: string | null;
  email_chase3_subject?: string | null;
  email_chase3_body?: string | null;
  notif_rent_overdue?: boolean | null;
  notif_rent_overdue_days?: number | null;
  notif_escalation?: boolean | null;
  notif_approval_ready?: boolean | null;
  notif_approval_queue_threshold?: number | null;
  notif_maintenance?: boolean | null;
  notif_weekly_digest?: boolean | null;
  notif_digest_day?: string | null;
  notif_digest_time?: string | null;
  theme_preference?: string | null;
};

function mapDbRowToUserSettings(data: UserSettingsRowDb): UserSettingsRow {
  const rawTone = (data.rent_chaser_tone ?? "professional_firm") as string;
  /** Map legacy `friendly_reminder` to `friendly_polite` so the tone Select matches options. */
  const mapped =
    rawTone === "friendly_reminder" ? "friendly_polite" : (rawTone as UserSettingsInput["rentChaserTone"]);
  const rentChaserTone: UserSettingsInput["rentChaserTone"] =
    mapped === "professional_firm" || mapped === "friendly_polite" || mapped === "formal_legal"
      ? mapped
      : "professional_firm";

  return {
    id: data.id,
    userId: data.user_id,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeConnectAccountId: data.stripe_connect_account_id ?? null,
    polarCustomerId: data.polar_customer_id ?? null,
    polarSubscriptionId: data.polar_subscription_id ?? null,
    businessName: data.business_name ?? "",
    landlordName: data.landlord_name ?? "",
    contactPhone: data.contact_phone ?? "",
    contactEmail: data.contact_email ?? "",
    businessAddress: data.business_address ?? "",
    rentChaserTone,
    firstChaseDays: data.first_chase_days ?? 3,
    emailSignoff: data.email_signoff ?? "",
    includePaymentPlan: data.include_payment_plan ?? true,
    emailFromName: data.email_from_name ?? "",
    autoSendRentChaser: data.auto_send_rent_chaser ?? false,
    autoSendMaintenanceUpdates: data.auto_send_maintenance_updates ?? false,
    autoSendOnboardingEmails: data.auto_send_onboarding_emails ?? false,
    autoSendLeadUpdates: data.auto_send_lead_updates ?? false,
    autoSendReferencingEmails: data.auto_send_referencing_emails ?? false,
    referencingAgencyName: data.referencing_agency_name ?? "",
    referencingAgencyEmail: data.referencing_agency_email ?? "",
    referencingAgencyNotes: data.referencing_agency_notes ?? "",
    rentChaserInstructions: data.rent_chaser_instructions ?? "",
    minLeadScore: data.min_lead_score ?? 70,
    preferredSources: (data.preferred_sources ?? []) as UserSettingsInput["preferredSources"],
    disqualifyNoMovein: data.disqualify_no_movein ?? false,
    leadQualifierCriteria: data.lead_qualifier_criteria ?? "",
    onboardingStatus: parseOnboardingStatus(data.onboarding_status),
    onboardingPrimaryGoal: data.onboarding_primary_goal ?? null,
    hasSeenTour: Boolean(data.has_seen_tour),
    onboardingSetupReminderDismissedAt: data.onboarding_setup_reminder_dismissed_at ?? null,
    subscriptionPlan: data.subscription_plan ?? null,
    subscriptionStatus: data.subscription_status ?? null,
    subscriptionPeriodEnd: data.subscription_period_end ?? null,
    subscriptionTrialEnd: data.subscription_trial_end ?? null,
    /* Organisation */
    orgName: data.org_name ?? "",
    orgLogoUrl: data.org_logo_url ?? "",
    orgContactEmail: data.org_contact_email ?? "",
    orgPhone: data.org_phone ?? "",
    orgAddress: data.org_address ?? "",
    /* Profile */
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    avatarUrl: data.avatar_url ?? "",
    /* AI & chasing */
    chaseTriggerDays: data.chase_trigger_days ?? 3,
    chaseMaxPerMonth: data.chase_max_per_month ?? 3,
    chaseMinGapDays: data.chase_min_gap_days ?? 5,
    chaseAllowWeekends: Boolean(data.chase_allow_weekends ?? false),
    chaseEscalationThreshold: data.chase_escalation_threshold ?? 3,
    chaseTone1: parseTone(data.chase_tone_1, "friendly"),
    chaseTone2: parseTone(data.chase_tone_2, "firm"),
    chaseTone3: parseTone(data.chase_tone_3, "formal"),
    chaseRequireApproval: Boolean(data.chase_require_approval ?? true),
    chaseAiProactive: Boolean(data.chase_ai_proactive ?? true),
    /* Email templates */
    emailSenderName: data.email_sender_name ?? "",
    emailReplyTo: data.email_reply_to ?? "",
    emailChase1Subject: data.email_chase1_subject ?? "",
    emailChase1Body: data.email_chase1_body ?? "",
    emailChase2Subject: data.email_chase2_subject ?? "",
    emailChase2Body: data.email_chase2_body ?? "",
    emailChase3Subject: data.email_chase3_subject ?? "",
    emailChase3Body: data.email_chase3_body ?? "",
    /* Notifications */
    notifRentOverdue: Boolean(data.notif_rent_overdue ?? true),
    notifRentOverdueDays: data.notif_rent_overdue_days ?? 1,
    notifEscalation: Boolean(data.notif_escalation ?? true),
    notifApprovalReady: Boolean(data.notif_approval_ready ?? true),
    notifApprovalQueueThreshold: data.notif_approval_queue_threshold ?? 5,
    notifMaintenance: Boolean(data.notif_maintenance ?? true),
    notifWeeklyDigest: Boolean(data.notif_weekly_digest ?? true),
    notifDigestDay: parseDigestDay(data.notif_digest_day),
    notifDigestTime: data.notif_digest_time ?? "08:00",
    /* Appearance */
    themePreference: parseTheme(data.theme_preference),
  };
}

export type UserSettingsFetchResult =
  | { ok: true; row: UserSettingsRow | null }
  | { ok: false; error: string };

/** Full settings row read with explicit fetch failure (for the settings page banner). */
export async function fetchUserSettingsRow(userId: string): Promise<UserSettingsFetchResult> {
  const supabase = await createClient();
  const { data: rawData, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[fetchUserSettingsRow]", error.message);
    return { ok: false, error: error.message };
  }
  if (!rawData) {
    return { ok: true, row: null };
  }
  return { ok: true, row: mapDbRowToUserSettings(rawData as unknown as UserSettingsRowDb) };
}

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  const r = await fetchUserSettingsRow(userId);
  return r.ok ? r.row : null;
}

/** Narrow read for dashboard theme bootstrap (avoids wide selects in layout). */
export async function getThemePreferenceForUser(userId: string): Promise<ThemePreference> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("theme_preference")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "system";
  return parseTheme((data as { theme_preference?: string | null }).theme_preference);
}

export async function markProductTourComplete(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: updated, error } = await supabase
    .from("user_settings")
    .update({ has_seen_tour: true, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("id");

  if (error)
    return { ok: false, error: userFacingError(error.message, "We couldn't update that setting. Please try again.") };
  if (updated && updated.length > 0) {
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("user_settings").insert({
    user_id: user.id,
    has_seen_tour: true,
    updated_at: new Date().toISOString(),
  });

  if (insertError)
    return { ok: false, error: userFacingError(insertError.message, "We couldn't save that setting. Please try again.") };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveSettings(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = userSettingsSchema.safeParse(formData);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      Object.values(first)
        .flat()
        .filter(Boolean)[0] ??
      parsed.error.issues[0]?.message ??
      "Invalid settings data";
    return { ok: false as const, error: msg };
  }

  const values = parsed.data;

  const { data: existingProfile } = await supabase
    .from("user_settings")
    .select("business_name, landlord_name")
    .eq("user_id", user.id)
    .maybeSingle();

  /** Avoid wiping names when the form was empty (e.g. stale defaults) but onboarding already saved them. */
  function coalesceName(formVal: string | undefined, dbVal: string | null | undefined): string | null {
    const t = (formVal ?? "").trim();
    if (t.length > 0) return t;
    const e = (dbVal ?? "").trim();
    return e.length > 0 ? e : null;
  }

  const business_name = coalesceName(values.businessName, existingProfile?.business_name);
  const landlord_name = coalesceName(values.landlordName, existingProfile?.landlord_name);

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      business_name,
      landlord_name,
      contact_phone: values.contactPhone || null,
      contact_email: values.contactEmail || null,
      business_address: values.businessAddress || null,
      rent_chaser_tone: values.rentChaserTone,
      first_chase_days: values.firstChaseDays,
      email_signoff: values.emailSignoff || null,
      include_payment_plan: values.includePaymentPlan,
      email_from_name: values.emailFromName || null,
      auto_send_rent_chaser: values.autoSendRentChaser,
      auto_send_maintenance_updates: values.autoSendMaintenanceUpdates,
      auto_send_onboarding_emails: values.autoSendOnboardingEmails,
      auto_send_lead_updates: values.autoSendLeadUpdates,
      auto_send_referencing_emails: values.autoSendReferencingEmails,
      referencing_agency_name: values.referencingAgencyName || null,
      referencing_agency_email: values.referencingAgencyEmail || null,
      referencing_agency_notes: values.referencingAgencyNotes || null,
      rent_chaser_instructions: values.rentChaserInstructions || null,
      min_lead_score: values.minLeadScore,
      preferred_sources: values.preferredSources,
      disqualify_no_movein: values.disqualifyNoMovein,
      lead_qualifier_criteria: values.leadQualifierCriteria || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error)
    return {
      ok: false as const,
      error: userFacingError(error.message, "We couldn't save your settings. Please try again."),
    };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/billing");
  return { ok: true as const };
}

/* -------------------------------------------------------------------------- */
/* Section-scoped mutations used by the new tabbed settings panel.            */
/* Each one upserts only the columns belonging to its section so independent  */
/* tabs can save without overwriting one another's values.                    */
/* -------------------------------------------------------------------------- */

type SectionResult = { ok: true } | { ok: false; error: string };

async function upsertSection(
  patch: Record<string, unknown>,
): Promise<SectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error)
    return {
      ok: false,
      error: userFacingError(error.message, "We couldn't save your settings. Please try again."),
    };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveOrganisationSettings(input: OrganisationSettingsInput): Promise<SectionResult> {
  const parsed = organisationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid organisation settings.",
    };
  }
  const v = parsed.data;
  return upsertSection({
    org_name: v.orgName?.trim() || null,
    org_logo_url: v.orgLogoUrl?.trim() || null,
    org_contact_email: v.orgContactEmail?.trim() || null,
    org_phone: v.orgPhone?.trim() || null,
    org_address: v.orgAddress?.trim() || null,
    /** Mirror to legacy column so existing agent prompts that read `business_name` keep working. */
    business_name: v.orgName?.trim() || null,
  });
}

export async function saveProfileSettings(input: ProfileSettingsInput): Promise<SectionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profile settings.",
    };
  }
  const v = parsed.data;
  const fullName = [v.firstName?.trim(), v.lastName?.trim()].filter(Boolean).join(" ");
  const result = await upsertSection({
    first_name: v.firstName?.trim() || null,
    last_name: v.lastName?.trim() || null,
    avatar_url: v.avatarUrl?.trim() || null,
    /** Keep legacy landlord_name in sync so chase emails address the same person. */
    landlord_name: fullName.length > 0 ? fullName : null,
  });
  if (result.ok) {
    revalidatePath("/dashboard");
  }
  return result;
}

export async function saveAiChaseSettings(input: AiChaseSettingsInput): Promise<SectionResult> {
  const parsed = aiChaseSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid AI & chasing settings.",
    };
  }
  const v = parsed.data;
  return upsertSection({
    chase_trigger_days: v.chaseTriggerDays,
    chase_max_per_month: v.chaseMaxPerMonth,
    chase_min_gap_days: v.chaseMinGapDays,
    chase_allow_weekends: v.chaseAllowWeekends,
    chase_escalation_threshold: v.chaseEscalationThreshold,
    chase_tone_1: v.chaseTone1,
    chase_tone_2: v.chaseTone2,
    chase_tone_3: v.chaseTone3,
    chase_require_approval: v.chaseRequireApproval,
    chase_ai_proactive: v.chaseAiProactive,
    /** Legacy column kept in sync for the existing rent-chaser pipeline. */
    first_chase_days: v.chaseTriggerDays,
  });
}

export async function saveEmailTemplatesSettings(
  input: EmailTemplatesSettingsInput,
): Promise<SectionResult> {
  const parsed = emailTemplatesSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid email template settings.",
    };
  }
  const v = parsed.data;
  return upsertSection({
    email_sender_name: v.emailSenderName?.trim() || null,
    email_reply_to: v.emailReplyTo?.trim() || null,
    email_chase1_subject: v.emailChase1Subject?.trim() || null,
    email_chase1_body: v.emailChase1Body?.trim() || null,
    email_chase2_subject: v.emailChase2Subject?.trim() || null,
    email_chase2_body: v.emailChase2Body?.trim() || null,
    email_chase3_subject: v.emailChase3Subject?.trim() || null,
    email_chase3_body: v.emailChase3Body?.trim() || null,
  });
}

export async function saveNotificationSettings(
  input: NotificationSettingsInput,
): Promise<SectionResult> {
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid notification settings.",
    };
  }
  const v = parsed.data;
  return upsertSection({
    notif_rent_overdue: v.notifRentOverdue,
    notif_rent_overdue_days: v.notifRentOverdueDays,
    notif_escalation: v.notifEscalation,
    notif_approval_ready: v.notifApprovalReady,
    notif_approval_queue_threshold: v.notifApprovalQueueThreshold,
    notif_maintenance: v.notifMaintenance,
    notif_weekly_digest: v.notifWeeklyDigest,
    notif_digest_day: v.notifDigestDay,
    notif_digest_time: v.notifDigestTime,
  });
}

export async function saveAppearanceSettings(
  input: AppearanceSettingsInput,
): Promise<SectionResult> {
  const parsed = appearanceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid appearance settings.",
    };
  }
  return upsertSection({ theme_preference: parsed.data.themePreference });
}
