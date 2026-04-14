import { NextResponse, type NextRequest } from "next/server";

import { mergeResponseCookies, updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";
  const isSignupRoute = pathname === "/signup";
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  const { response, user, supabase } = await updateSession(request);

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
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/onboarding",
    "/onboarding/:path*",
    "/auth/callback",
    "/auth/continue",
  ],
};
