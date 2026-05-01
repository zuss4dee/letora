"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { type OnboardingStatus, parseOnboardingStatus } from "@/lib/onboarding/status";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";
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
  /** Stripe subscription display name (e.g. Pro). */
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPeriodEnd?: string | null;
  subscriptionTrialEnd?: string | null;
};

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "id,user_id,stripe_customer_id,stripe_connect_account_id,polar_customer_id,polar_subscription_id,business_name,landlord_name,contact_phone,contact_email,business_address,rent_chaser_tone,first_chase_days,email_signoff,include_payment_plan,email_from_name,auto_send_rent_chaser,auto_send_maintenance_updates,auto_send_onboarding_emails,auto_send_lead_updates,auto_send_referencing_emails,referencing_agency_name,referencing_agency_email,referencing_agency_notes,rent_chaser_instructions,min_lead_score,preferred_sources,disqualify_no_movein,lead_qualifier_criteria,onboarding_status,onboarding_primary_goal,onboarding_setup_reminder_dismissed_at,has_seen_tour,subscription_plan,subscription_status,subscription_period_end,subscription_trial_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

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
    onboardingStatus: parseOnboardingStatus((data as { onboarding_status?: string | null }).onboarding_status),
    onboardingPrimaryGoal: (data as { onboarding_primary_goal?: string | null }).onboarding_primary_goal ?? null,
    hasSeenTour: Boolean((data as { has_seen_tour?: boolean | null }).has_seen_tour),
    onboardingSetupReminderDismissedAt:
      (data as { onboarding_setup_reminder_dismissed_at?: string | null }).onboarding_setup_reminder_dismissed_at ??
      null,
    subscriptionPlan: (data as { subscription_plan?: string | null }).subscription_plan ?? null,
    subscriptionStatus: (data as { subscription_status?: string | null }).subscription_status ?? null,
    subscriptionPeriodEnd: (data as { subscription_period_end?: string | null }).subscription_period_end ?? null,
    subscriptionTrialEnd: (data as { subscription_trial_end?: string | null }).subscription_trial_end ?? null,
  };
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

