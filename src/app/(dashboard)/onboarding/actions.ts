"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-errors";
import { type LandlordType, LANDLORD_TYPE_VALUES } from "@/lib/onboarding/landlord-wizard";

function isLandlordType(v: string): v is LandlordType {
  return (LANDLORD_TYPE_VALUES as readonly string[]).includes(v);
}

export async function saveOnboardingStep(
  step: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(step) || step < 1 || step > 3) {
    return { ok: false, error: "Invalid step." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      onboarding_step: step,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      ok: false,
      error: userFacingError(error.message, "We couldn't save your progress. Please try again."),
    };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveLandlordType(
  type: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLandlordType(type)) {
    return { ok: false, error: "Invalid selection." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      landlord_type: type,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      ok: false,
      error: userFacingError(error.message, "We couldn't save that. Please try again."),
    };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function completeOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      onboarding_status: "completed",
      onboarding_step: 3,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      ok: false,
      error: userFacingError(error.message, "We couldn't finish onboarding. Please try again."),
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { ok: true };
}
