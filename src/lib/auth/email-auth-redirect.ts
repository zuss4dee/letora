/**
 * Absolute URL for Supabase `emailRedirectTo` (sign-up + resend confirmation).
 * Add this exact origin + path to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * (e.g. `https://yourdomain.com/auth/callback` and `http://localhost:3000/auth/callback`).
 */
export function getBrowserAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin.replace(/\/$/, "")}/auth/callback`;
}
