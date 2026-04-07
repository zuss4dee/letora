import { NextResponse, type NextRequest } from "next/server";

import { mergeResponseCookies, updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  const { response, user } = await updateSession(request);

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    mergeResponseCookies(response, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
