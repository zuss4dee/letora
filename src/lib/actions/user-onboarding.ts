"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addProperty } from "@/lib/actions/properties";
import { mockResolveUkAddress } from "@/lib/onboarding/mock-address";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import { focusSelectionSchema, serializePrimaryGoals } from "@/lib/onboarding/priorities";
import { createClient } from "@/lib/supabase/server";
import { optionalEmailSchema } from "@/lib/validations/email";
import { userFacingError } from "@/lib/user-facing-errors";

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

/** Step 2 — prioritisation (1–4 selections); upserts so saves succeed even if the row was missing. */
export async function saveOnboardingFocus(input: {
  focusIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const parsed = focusSelectionSchema.safeParse([...new Set(input.focusIds)]);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Choose between 1 and 4 priorities.";
    return { ok: false, error: msg };
  }

  const storedJson = serializePrimaryGoals(parsed.data);
  const ts = new Date().toISOString();

  // Use `property_pending` (not `settings_pending`) so saves work on DBs that only allow the
  // original check constraint: profile_pending | property_pending | completed.
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      onboarding_primary_goal: storedJson,
      onboarding_status: "property_pending",
      updated_at: ts,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[saveOnboardingFocus]", error.code, error.message);
    return {
      ok: false,
      error: userFacingError(
        error.message,
        "We couldn't save your priorities. Please check your connection and try again.",
      ),
    };
  }

  revalidatePath("/onboarding");
  return { ok: true };
}

const onboardingSettingsEssentialsSchema = z.object({
  /** Company / portfolio label from step 0 — re-saved here so a partial upsert cannot leave business_name missing. */
  portfolioName: z.string().trim().optional(),
  landlordName: z.string().trim().min(2, "Enter the landlord or legal name."),
  contactEmail: optionalEmailSchema,
  referencingAgencyEmail: optionalEmailSchema,
});

/** Step after focus — required profile fields used across emails and compliance. */
export async function saveOnboardingSettingsEssentials(input: {
  portfolioName?: string;
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

  const ts = new Date().toISOString();
  const portfolio = parsed.data.portfolioName?.trim() ?? "";
  const payload: Record<string, unknown> = {
    user_id: user.id,
    landlord_name: parsed.data.landlordName.trim(),
    contact_email: parsed.data.contactEmail.trim() || null,
    referencing_agency_email: parsed.data.referencingAgencyEmail.trim() || null,
    onboarding_status: "property_pending",
    updated_at: ts,
  };
  if (portfolio.length >= 2) {
    payload.business_name = portfolio;
  }

  const { error } = await supabase.from("user_settings").upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[saveOnboardingSettingsEssentials]", error.message);
    return { ok: false, error: userFacingError(error.message, "We couldn't save your details. Please try again.") };
  }

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

  const statusRes = await setUserOnboardingStatus(user.id, "completed");
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
 * guided onboarding finishes after first property (tenants from the dashboard).
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

/**
 * Users left on `property_pending` from older flows: if landlord details and a first property
 * already exist, mark onboarding completed so they can use the dashboard.
 */
export async function syncLegacyOnboardingAfterTenantStepRemoved(): Promise<
  { ok: true; didComplete: boolean } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: row } = await supabase
    .from("user_settings")
    .select("onboarding_status, landlord_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const status = (row as { onboarding_status?: string | null } | null)?.onboarding_status ?? "profile_pending";
  const landlordName = (row as { landlord_name?: string | null } | null)?.landlord_name;

  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const propertyCount = count ?? 0;
  const settingsComplete = Boolean(landlordName?.trim());

  if (status === "property_pending" && settingsComplete && propertyCount >= 1) {
    const statusRes = await setUserOnboardingStatus(user.id, "completed");
    if (!statusRes.ok) return { ok: false, error: statusRes.error };

    revalidatePath("/onboarding");
    revalidatePath("/onboarding", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard", "layout");
    return { ok: true, didComplete: true };
  }

  return { ok: true, didComplete: false };
}

/**
 * Exit the guided wizard and open the dashboard. Shows a checklist there until profile,
 * first property, and remaining setup items exist (or the user dismisses the reminder).
 */
export async function skipOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const ts = new Date().toISOString();
  const { data: existing, error: selErr } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    console.error("[skipOnboarding]", selErr.message);
    return { ok: false, error: "We couldn't update your account. Try again." };
  }

  if (existing) {
    const { error } = await supabase
      .from("user_settings")
      .update({
        onboarding_status: "completed",
        onboarding_setup_reminder_dismissed_at: null,
        updated_at: ts,
      })
      .eq("user_id", user.id);
    if (error) {
      return { ok: false, error: userFacingError(error.message, "We couldn't save your choice. Please try again.") };
    }
  } else {
    const { error } = await supabase.from("user_settings").insert({
      user_id: user.id,
      onboarding_status: "completed",
      onboarding_setup_reminder_dismissed_at: null,
      updated_at: ts,
    });
    if (error) {
      return { ok: false, error: userFacingError(error.message, "We couldn't save your choice. Please try again.") };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

export async function dismissWorkspaceSetupReminder(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("user_settings")
    .update({
      onboarding_setup_reminder_dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: userFacingError(error.message, "We couldn't update that. Please try again.") };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
