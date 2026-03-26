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
      "id,user_id,business_name,landlord_name,contact_phone,contact_email,business_address,rent_chaser_tone,first_chase_days,email_signoff,include_payment_plan,rent_chaser_instructions,min_lead_score,preferred_sources,disqualify_no_movein,lead_qualifier_criteria",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    businessName: data.business_name ?? "",
    landlordName: data.landlord_name ?? "",
    contactPhone: data.contact_phone ?? "",
    contactEmail: data.contact_email ?? "",
    businessAddress: data.business_address ?? "",
    rentChaserTone: (data.rent_chaser_tone ?? "professional_firm") as UserSettingsInput["rentChaserTone"],
    firstChaseDays: data.first_chase_days ?? 3,
    emailSignoff: data.email_signoff ?? "",
    includePaymentPlan: data.include_payment_plan ?? true,
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
  if (!parsed.success) return { ok: false as const, error: "Invalid settings data" };

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

