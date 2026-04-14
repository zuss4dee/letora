# Supabase auth (Letora)

## Email confirmation and magic links

- **Redirect URL:** Add your app origin plus `/auth/callback` (e.g. `https://app.example.com/auth/callback`) under **Authentication → URL configuration → Redirect URLs** in the Supabase dashboard. Prefer this URL in templates and `emailRedirectTo` so links go straight to the handler.
- **Site URL only:** If confirmations still redirect to **Site URL** (`/`, `/pricing`, etc.) with `?code=` or hash tokens, middleware and `AuthDeepLinkRecover` forward those to `/auth/callback` so the session is still established; you should still add `/auth/callback` to **Redirect URLs** for PKCE.
- **PKCE:** The app uses `@supabase/ssr` with `flowType: "pkce"` in the browser client. Email confirmations should use the **PKCE** / code flow so Supabase redirects with `?code=...` (not only hash tokens).
- **Implicit / hash tokens:** If a project still sends `access_token` in the URL **hash**, the `/auth/callback` client page parses the hash and calls `setSession` so the session cookies are still written.

## Related code

- Client handler: `src/app/auth/callback/auth-callback-client.tsx`
- Signup / resend `emailRedirectTo`: `src/app/(auth)/signup/page.tsx` (`/auth/callback`)
- Post-session router: `src/app/auth/continue/route.ts` (pending Stripe checkout, then dashboard/onboarding)
