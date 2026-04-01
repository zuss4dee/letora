"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";

export type UserSettingsRow = UserSettingsInput & {
  id?: string;
  userId?: string;
};

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "id,user_id,business_name,landlord_name,contact_phone,contact_email,business_address,rent_chaser_tone,first_chase_days,email_signoff,include_payment_plan,email_from_name,auto_send_rent_chaser,auto_send_maintenance_updates,auto_send_onboarding_emails,auto_send_lead_updates,auto_send_referencing_emails,referencing_agency_name,referencing_agency_email,referencing_agency_notes,rent_chaser_instructions,min_lead_score,preferred_sources,disqualify_no_movein,lead_qualifier_criteria",
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
  };
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

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      business_name: values.businessName || null,
      landlord_name: values.landlordName || null,
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

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

