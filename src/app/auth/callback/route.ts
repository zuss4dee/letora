import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * PKCE / email-link callback. Session cookies from `exchangeCodeForSession` must be
 * written onto the **same** `NextResponse` we return. Using `cookies()` from
 * `next/headers` with `NextResponse.redirect()` often drops Set-Cookie, so the
 * browser never gets a session and middleware sends people back to login or the
 * marketing site.
 *
 * After success, always send people through `/auth/continue` so pending Stripe
 * checkout (email-confirm signups) runs before onboarding.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const continueUrl = new URL("/auth/continue", requestUrl.origin);
  const nextRaw = requestUrl.searchParams.get("next");
  if (nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    continueUrl.searchParams.set("next", nextRaw);
  }

  let response = NextResponse.redirect(continueUrl);

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
