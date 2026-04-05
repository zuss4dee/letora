import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-only. Never import from client components.
 * Used for account deletion, webhooks, cron, and other privileged operations.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin operations.",
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Alias used by account deletion and newer code. */
export const createAdminClient = createServiceRoleClient;
