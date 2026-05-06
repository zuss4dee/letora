"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { exchangeSupabaseAuthCode, verifySupabaseEmailOtp } from "@/lib/actions/auth-callback";
import { createClient } from "@/lib/supabase/client";

/** Values Supabase may send on `redirect_to` after /auth/v1/verify (email confirmation, etc.). */
const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
  "phone_change",
]);

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !EMAIL_OTP_TYPES.has(raw)) return null;
  return raw as EmailOtpType;
}

function buildContinuePath(nextParam: string | null): string {
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return `/auth/continue?next=${encodeURIComponent(nextParam)}`;
  }
  return "/auth/continue";
}

/** Avoid exposing low-level Supabase copy (PKCE storage, etc.) on the login screen. */
function userSafeCallbackErrorMessage(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const m = raw.toLowerCase();
  if (m.includes("pkce") || m.includes("code verifier")) {
    return "This link has expired or was opened in another browser or device than where you started. Sign in with your email and password, or request a new confirmation email from the sign-up page.";
  }
  return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
}

function redirectToLogin(
  router: ReturnType<typeof useRouter>,
  opts: { reason?: string; message?: string; emailHint?: string },
) {
  const q = new URLSearchParams();
  q.set("auth_error", "callback");
  if (opts.reason) q.set("reason", opts.reason.slice(0, 200));
  const safe = userSafeCallbackErrorMessage(opts.message);
  if (safe) q.set("message", safe.slice(0, 320));
  if (opts.emailHint) q.set("email", opts.emailHint.slice(0, 320));
  router.replace(`/login?${q.toString()}`);
}

/**
 * Finishes email confirmation / OAuth: PKCE `code` in query and/or implicit tokens in the hash.
 * PKCE `code` and `token_hash` flows call server actions so the session is written from the request
 * cookies (code verifier). Hash fragment tokens still use the browser client (`setSession`).
 */
export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const nextParam = searchParams.get("next");
      const continuePath = buildContinuePath(nextParam);

      const codeFromQuery = searchParams.get("code");
      const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      const hashParams = hash ? new URLSearchParams(hash) : null;

      const tokenHash = searchParams.get("token_hash") ?? hashParams?.get("token_hash") ?? null;
      const otpTypeRaw = searchParams.get("type") ?? hashParams?.get("type") ?? null;
      const otpType = parseEmailOtpType(otpTypeRaw);

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

      if (tokenHash && !otpType) {
        console.warn("[auth/callback] token_hash without a valid type query param");
        if (!cancelled) {
          setStatus("error");
          redirectToLogin(router, {
            reason: "invalid_confirmation_link",
            message: "This confirmation link is incomplete or expired. Request a new email from sign up.",
          });
        }
        return;
      }

      try {
        if (tokenHash && otpType) {
          const res = await verifySupabaseEmailOtp({ token_hash: tokenHash, type: otpType });
          if (res.ok === false) {
            console.error("[auth/callback] verifyOtp:", res.error);
            if (!cancelled) {
              setStatus("error");
              redirectToLogin(router, { reason: "verify_otp_failed", message: res.error });
            }
            return;
          }
        } else if (code) {
          const res = await exchangeSupabaseAuthCode(code);
          if (res.ok === false) {
            console.error("[auth/callback] exchangeCodeForSession:", res.error);
            if (!cancelled) {
              setStatus("error");
              redirectToLogin(router, { reason: "exchange_failed", message: res.error });
            }
            return;
          }
        } else if (accessToken && refreshToken) {
          const supabase = createClient();
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

        const supabase = createClient();
        await router.refresh();
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
          const clean = new URLSearchParams(window.location.search);
          for (const k of ["token_hash", "type", "code", "error", "error_description"]) {
            clean.delete(k);
          }
          const qs = clean.toString();
          const path = window.location.pathname;
          window.history.replaceState(null, "", `${path}${qs ? `?${qs}` : ""}`);
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
