"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Permanently deletes the signed-in user from Supabase Auth and, with FK cascades,
 * removes associated application data. Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export async function deleteAccount(confirmation: string): Promise<{ ok: boolean; error?: string }> {
  const phrase = confirmation.trim().toUpperCase();
  if (phrase !== "DELETE") {
    return { ok: false, error: "Type DELETE exactly to confirm." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    console.error("[deleteAccount] service role client unavailable");
    return {
      ok: false,
      error: "We couldn't complete account deletion right now. Please try again later or contact support.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[deleteAccount] admin.deleteUser failed", {
      userId: user.id,
      message: error.message,
      code: "code" in error ? (error as { code?: string }).code : undefined,
    });
    return {
      ok: false,
      error:
        "We couldn't remove your account right now. Please try again in a few minutes, or contact support and we'll help you finish this.",
    };
  }

  return { ok: true };
}
