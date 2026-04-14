"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function buildContinuePath(nextParam: string | null): string {
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return `/auth/continue?next=${encodeURIComponent(nextParam)}`;
  }
  return "/auth/continue";
}

function redirectToLogin(
  router: ReturnType<typeof useRouter>,
  opts: { reason?: string; message?: string; emailHint?: string },
) {
  const q = new URLSearchParams();
  q.set("auth_error", "callback");
  if (opts.reason) q.set("reason", opts.reason.slice(0, 200));
  if (opts.message) q.set("message", opts.message.slice(0, 200));
  if (opts.emailHint) q.set("email", opts.emailHint.slice(0, 320));
  router.replace(`/login?${q.toString()}`);
}

/**
 * Finishes email confirmation / OAuth: PKCE `code` in query and/or implicit tokens in the hash.
 * Persists session via Supabase browser client (cookie storage), then sends the user to `/auth/continue`.
 */
export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const nextParam = searchParams.get("next");
      const continuePath = buildContinuePath(nextParam);

      const codeFromQuery = searchParams.get("code");
      const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      const hashParams = hash ? new URLSearchParams(hash) : null;

      const oauthError = hashParams?.get("error") ?? searchParams.get("error");
      const oauthErrorDescription =
        hashParams?.get("error_description") ?? searchParams.get("error_description");

      if (oauthError) {
        console.error("[auth/callback] OAuth error:", oauthError, oauthErrorDescription ?? "");
        if (!cancelled) {
          setStatus("error");
          redirectToLogin(router, {
            reason: oauthError,
            message: oauthErrorDescription ?? undefined,
          });
        }
        return;
      }

      const codeFromHash = hashParams?.get("code");
      const code = codeFromQuery ?? codeFromHash ?? null;

      const accessToken = hashParams?.get("access_token");
      const refreshToken = hashParams?.get("refresh_token");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[auth/callback] exchangeCodeForSession:", error.message);
            if (!cancelled) {
              setStatus("error");
              redirectToLogin(router, { reason: "exchange_failed", message: error.message });
            }
            return;
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error("[auth/callback] setSession:", error.message);
            if (!cancelled) {
              setStatus("error");
              redirectToLogin(router, { reason: "session_failed", message: error.message });
            }
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          console.warn("[auth/callback] No session after handling URL params");
          if (!cancelled) {
            setStatus("error");
            redirectToLogin(router, { reason: "no_session" });
          }
          return;
        }

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }

        if (!cancelled) router.replace(continuePath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("[auth/callback]", e);
        if (!cancelled) {
          setStatus("error");
          redirectToLogin(router, { reason: "unexpected", message: msg });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-headline text-sm font-light text-muted-foreground">
        {status === "working" ? "Signing you in…" : "Something went wrong. Redirecting to sign in…"}
      </p>
    </div>
  );
}
