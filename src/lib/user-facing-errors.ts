/**
 * Map and sanitize errors shown to people using the product (not operators).
 * Raw provider messages often mention SQL, constraints, or migrations — never show those in UI.
 */

const TECHNICAL_PATTERNS = [
  /sqlstate/i,
  /postgres/i,
  /\bforeign key\b/i,
  /\bconstraint\b/i,
  /\bviolates\b/i,
  /\bmigration\b/i,
  /supabase db/i,
  /service_role/i,
  /internal server error/i,
  /\b500\b.*database/i,
  /database error/i,
];

export function isLikelyTechnicalErrorMessage(message: string): boolean {
  const m = message.trim();
  if (!m) return true;
  if (m.length > 400) return true;
  return TECHNICAL_PATTERNS.some((p) => p.test(m));
}

/**
 * Prefer a safe fallback when the provider message looks technical or empty.
 */
export function userFacingError(raw: string | undefined | null, fallback: string): string {
  const m = (raw ?? "").trim();
  if (!m) return fallback;
  if (isLikelyTechnicalErrorMessage(m)) return fallback;
  return m;
}

export type SignInErrorKind = "invalid_credentials" | "email_not_confirmed" | "rate_limit" | "other";

export function classifySignInError(error: { message?: string; code?: string }): SignInErrorKind {
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  if (code === "too_many_requests" || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limit";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    (msg.includes("invalid") && msg.includes("credential"))
  ) {
    return "invalid_credentials";
  }
  return "other";
}

/** When sign-in fails with an unclassified error, avoid leaking implementation details. */
export function signInErrorMessageForOther(raw: string | undefined | null): string {
  const m = (raw ?? "").trim();
  if (!m) return "Something went wrong while signing in. Please try again in a moment.";
  if (isLikelyTechnicalErrorMessage(m)) {
    return "Something went wrong while signing in. Please try again in a moment.";
  }
  return m;
}

export function signUpErrorForUser(error: { message?: string; code?: string }): string {
  const raw = error.message ?? "";
  const code = (error.code ?? "").toLowerCase();
  const msg = raw.toLowerCase();
  if (
    code === "user_already_registered" ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("email address is already") ||
    msg.includes("already been registered") ||
    msg.includes("duplicate key") ||
    msg.includes("unique constraint") ||
    (msg.includes("sign in") && msg.includes("already"))
  ) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (isLikelyTechnicalErrorMessage(raw)) {
    return "Something went wrong while creating your account. Please try again.";
  }
  return raw.trim() || "Something went wrong while creating your account. Please try again.";
}

/** Errors from `auth.resend` (signup confirmation, etc.) — keep copy friendly. */
export function resendAuthEmailErrorForUser(error: { message?: string; code?: string }): string {
  const raw = error.message ?? "";
  const code = (error.code ?? "").toLowerCase();
  const msg = raw.toLowerCase();
  if (code === "too_many_requests" || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many emails were sent. Wait a few minutes, then try again.";
  }
  if (
    msg.includes("signup") &&
    (msg.includes("disabled") || msg.includes("not enabled") || msg.includes("confirm email"))
  ) {
    return "Email confirmations may be turned off in the project settings, or this address can’t receive another signup email right now. Try signing in, or contact support.";
  }
  if (msg.includes("redirect") && (msg.includes("not allowed") || msg.includes("invalid"))) {
    return "The confirmation link URL isn’t allowed for this app. An administrator needs to add your site URL + /auth/callback under Supabase Authentication → URL Configuration → Redirect URLs.";
  }
  if (isLikelyTechnicalErrorMessage(raw)) {
    return "We couldn’t resend that email. Try again in a moment.";
  }
  return raw.trim() || "We couldn’t resend that email. Try again in a moment.";
}
