"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Exchange PKCE auth code using cookies from this request (includes `*-code-verifier`).
 * Prefer this over `exchangeCodeForSession` in a Client Component so email confirmation * works after redirects (middleware, new tab, etc.).
 */
export async function exchangeSupabaseAuthCode(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Missing Supabase configuration." };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* rare: read-only cookie store */
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function verifySupabaseEmailOtp(input: {
  token_hash: string;
  type: EmailOtpType;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Missing Supabase configuration." };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type: input.type,
    token_hash: input.token_hash,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
