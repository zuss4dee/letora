import { NextResponse, type NextRequest } from "next/server";

import { mergeResponseCookies, updateSession } from "@/lib/supabase/middleware";

function hasSupabaseAuthCallbackQuery(searchParams: NextRequest["nextUrl"]["searchParams"]): boolean {
  return (
    searchParams.has("code") ||
    searchParams.has("token_hash") ||
    searchParams.has("error")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";
  const isSignupRoute = pathname === "/signup";
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isMarketingRoot = pathname === "/";
  const isPricingRoute = pathname === "/pricing";

  const { response, user, supabase } = await updateSession(request);

  /**
   * Email confirmation / OAuth sometimes lands on **Site URL** (`/`, `/pricing`, etc.) or
   * `/login` instead of `/auth/callback`. Forward query params so the callback client can
   * exchange the session. (Hash fragments are handled in `AuthDeepLinkRecover`.)
   */
  const canRecoverAuthPath =
    isMarketingRoot || isPricingRoute || isLoginRoute || isSignupRoute;
  if (canRecoverAuthPath && hasSupabaseAuthCallbackQuery(request.nextUrl.searchParams)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  if (isOnboardingRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  /**
   * Onboarding gate: `user_settings.onboarding_status` must be `completed` before using /dashboard.
   * Skip when already on /onboarding (avoid redirect loop).
   */
  if (user && isDashboardRoute && !isOnboardingRoute) {
    const { data: row, error } = await supabase
      .from("user_settings")
      .select("onboarding_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[middleware] user_settings onboarding_status:", error.message);
    }

    const raw = (row as { onboarding_status?: string | null } | null)?.onboarding_status;
    const isComplete = typeof raw === "string" && raw.trim() === "completed";

    if (!isComplete) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      mergeResponseCookies(response, redirect);
      return redirect;
    }
  }

  if ((isLoginRoute || isSignupRoute) && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/continue";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/pricing",
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/onboarding",
    "/onboarding/:path*",
    "/auth/callback",
    "/auth/continue",
  ],
};
