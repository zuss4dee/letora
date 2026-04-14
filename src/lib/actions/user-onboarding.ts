"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addProperty } from "@/lib/actions/properties";
import { addTenant } from "@/lib/actions/tenants";
import { mockResolveUkAddress } from "@/lib/onboarding/mock-address";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";
import { tenantSchema } from "@/lib/validations/tenant";
import { userFacingError } from "@/lib/user-facing-errors";

/** UI values → stored onboarding_primary_goal slugs (existing column). */
const focusSchema = z.enum(["automate_rent", "legal_compliance", "lead_management"]);

const goalStorageMap: Record<z.infer<typeof focusSchema>, string> = {
  automate_rent: "automate_rent",
  legal_compliance: "stay_compliant",
  lead_management: "find_leads",
};

async function setUserOnboardingStatus(userId: string, status: OnboardingStatus) {
  const supabase = await createClient();
  const ts = new Date().toISOString();

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      onboarding_status: status,
      updated_at: ts,
    },
    { onConflict: "user_id" },
  );

  return error
    ? {
        ok: false as const,
        error: userFacingError(error.message, "We couldn't save your progress. Please try again."),
      }
    : { ok: true as const };
}

/** Step 1 — company / portfolio label only. */
export async function saveOnboardingIdentity(input: {
  portfolioName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const portfolioName = input.portfolioName.trim();
  if (portfolioName.length < 2) {
    return { ok: false, error: "Enter a company or portfolio name (at least 2 characters)." };
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      business_name: portfolioName,
      onboarding_status: "profile_pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error)
    return { ok: false, error: userFacingError(error.message, "We couldn't save your details. Please try again.") };

  revalidatePath("/onboarding");
  return { ok: true };
}

/** Step 2 — focus cards; moves pipeline to property step. */
export async function saveOnboardingFocus(input: {
  focus: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const parsed = focusSchema.safeParse(input.focus);
  if (!parsed.success) {
    return { ok: false, error: "Choose a focus." };
  }

  const stored = goalStorageMap[parsed.data];

  const { data: row } = await supabase.from("user_settings").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!row) {
    return { ok: false, error: "Complete the previous step first." };
  }

  const { error } = await supabase
    .from("user_settings")
    .update({
      onboarding_primary_goal: stored,
      onboarding_status: "settings_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error)
    return { ok: false, error: userFacingError(error.message, "We couldn't save your details. Please try again.") };

  revalidatePath("/onboarding");
  return { ok: true };
}

const onboardingSettingsEssentialsSchema = z.object({
  landlordName: z.string().trim().min(2, "Enter the landlord or legal name."),
  contactEmail: z.string().trim().email("Enter a valid agency contact email."),
  referencingAgencyEmail: z.string().trim().email("Enter a valid referencing / agency email."),
});

/** Step after focus — required profile fields used across emails and compliance. */
export async function saveOnboardingSettingsEssentials(input: {
  landlordName: string;
  contactEmail: string;
  referencingAgencyEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const parsed = onboardingSettingsEssentialsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Check the highlighted fields.";
    return { ok: false, error: first };
  }

  const { data: row } = await supabase.from("user_settings").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!row) {
    return { ok: false, error: "Complete the previous step first." };
  }

  const { error } = await supabase
    .from("user_settings")
    .update({
      landlord_name: parsed.data.landlordName.trim(),
      contact_email: parsed.data.contactEmail.trim(),
      referencing_agency_email: parsed.data.referencingAgencyEmail.trim(),
      onboarding_status: "property_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error)
    return { ok: false, error: userFacingError(error.message, "We couldn't save your details. Please try again.") };

  revalidatePath("/onboarding");
  return { ok: true };
}

const onboardingAddressSchema = z.object({
  address: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  postcode: z.string().trim().min(1, "Postcode is required"),
});

/**
 * Step 3 — create first property and finish onboarding.
 * Pass structured fields from the map/manual form, or a single line (parsed with the mock UK splitter).
 */
export async function completeOnboardingWithProperty(
  input: { address: string; city: string; postcode: string } | string,
): Promise<{ ok: true; propertyId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  let line1: string;
  let postcode: string;
  let city: string;

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length < 5) {
      return { ok: false, error: "Enter a full address so we can create the property." };
    }
    const resolved = mockResolveUkAddress(trimmed);
    line1 = resolved.line1;
    postcode = resolved.postcode;
    city = resolved.city;
  } else {
    const parsed = onboardingAddressSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Enter street, city, and postcode.";
      return { ok: false, error: first };
    }
    line1 = parsed.data.address;
    city = parsed.data.city;
    postcode = parsed.data.postcode;
  }

  const result = await addProperty({
    address: line1,
    postcode,
    city,
    propertyType: "House",
    bedrooms: 2,
    bathrooms: 1,
    monthlyRent: 0,
    status: "vacant",
    hasGasSupply: true,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const statusRes = await setUserOnboardingStatus(user.id, "tenant_pending");
  if (!statusRes.ok) {
    return { ok: false, error: statusRes.error };
  }

  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/onboarding", "layout");
  return { ok: true, propertyId: result.propertyId };
}

/**
 * Stripe checkout return on `/onboarding?checkout=success` — payment is confirmed in Stripe;
 * onboarding completion still requires property + tenant + settings (no longer auto-completes here).
 */
export async function completeOnboardingGate(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/** First tenant profile — marks onboarding complete when at least one property already exists. */
export async function completeOnboardingWithFirstTenant(formData: unknown): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { count: propertyCount, error: pcErr } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (pcErr || !propertyCount || propertyCount < 1) {
    return { ok: false, error: "Add a property before adding a tenant." };
  }

  const parsed = tenantSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tenant details." };
  }

  const tenantRes = await addTenant(parsed.data);
  if (!tenantRes.ok) return { ok: false, error: tenantRes.error };

  const statusRes = await setUserOnboardingStatus(user.id, "completed");
  if (!statusRes.ok) return { ok: false, error: statusRes.error };

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/** Onboarding must be finished in order — skipping is disabled. */
export async function skipOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  return {
    ok: false,
    error: "Complete setup to use Letora — add your details, a property, and a tenant.",
  };
}
