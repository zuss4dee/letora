"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addProperty } from "@/lib/actions/properties";
import { mockResolveUkAddress } from "@/lib/onboarding/mock-address";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

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

  return error ? { ok: false as const, error: error.message } : { ok: true as const };
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

  if (error) return { ok: false, error: error.message };

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
      onboarding_status: "property_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  return { ok: true };
}

/**
 * Step 3 — create first property and finish onboarding.
 */
export async function completeOnboardingWithProperty(addressLine: string): Promise<
  { ok: true; propertyId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const trimmed = addressLine.trim();
  if (trimmed.length < 5) {
    return { ok: false, error: "Enter a full address so we can create the property." };
  }

  const resolved = mockResolveUkAddress(trimmed);

  const result = await addProperty({
    address: resolved.line1,
    postcode: resolved.postcode,
    city: resolved.city,
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

/** Stripe checkout return (legacy) — marks onboarding complete if they land here after pay. */
export async function completeOnboardingGate(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const res = await setUserOnboardingStatus(user.id, "completed");
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/** User chose to explore the app without finishing setup — clears the gate like completing the flow. */
export async function skipOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  return completeOnboardingGate();
}
