"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * When Supabase confirms email using **Site URL** (e.g. `/`) instead of `/auth/callback`,
 * tokens often arrive in the URL **hash** — middleware cannot see hashes. Recover by
 * sending the full search + hash to `/auth/callback`, which already handles both flows.
 */
const PATHS_WITH_RECOVER = new Set(["/", "/login", "/signup", "/pricing"]);

export function AuthDeepLinkRecover() {
  const pathname = usePathname();

  useEffect(() => {
    if (!PATHS_WITH_RECOVER.has(pathname)) return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    if (params.has("access_token") || params.has("error") || params.has("code")) {
      const q = window.location.search;
      window.location.replace(`/auth/callback${q}${hash}`);
    }
  }, [pathname]);

  return null;
}
