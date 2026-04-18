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
  const isPlanGateRoute = pathname === "/onboarding/plan";
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
   * Plan + onboarding gates for authenticated users. Order matters:
   *   1. Plan-selection gate — they must have explicitly picked Starter/Pro/Portfolio
   *      (subscription_chosen_at IS NOT NULL) before they can reach /dashboard or
   *      the rest of the onboarding wizard.
   *   2. Onboarding completeness gate — `user_settings.onboarding_status = 'completed'`
   *      is required for /dashboard.
   *
   * We only read user_settings once per request and skip the lookup entirely on
   * non-gated routes.
   */
  const needsGateLookup =
    user && (isDashboardRoute || (isOnboardingRoute && !isPlanGateRoute));

  if (needsGateLookup) {
    const { data: row, error } = await supabase
      .from("user_settings")
      .select("onboarding_status, subscription_chosen_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[middleware] user_settings gate lookup:", error.message);
    }

    const settings = row as
      | { onboarding_status?: string | null; subscription_chosen_at?: string | null }
      | null;

    const hasChosenPlan = Boolean(settings?.subscription_chosen_at);

    if (!hasChosenPlan) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/plan";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      mergeResponseCookies(response, redirect);
      return redirect;
    }

    if (isDashboardRoute) {
      const raw = settings?.onboarding_status;
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
