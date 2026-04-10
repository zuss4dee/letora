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
    return {
      ok: false,
      error:
        "Account deletion is not available: server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in production and run the latest database migrations.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        " If this persists, run `supabase db push` so migrations through `20260427120000_account_deletion_storage_and_fk_repair.sql` apply (fixes storage.objects FKs and public cascades). Or contact support with the full error from Supabase logs.",
    };
  }

  return { ok: true };
}
