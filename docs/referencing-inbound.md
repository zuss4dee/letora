# Referencing handoff and inbound email

## Outbound

- Landlords configure a **default referencing agency** (Settings → Email & Automation) or a **per-tenancy email override** on the tenancy page.
- **Send referencing handoff** emails the agency with tenant name, email, phone, property address, tenancy dates, and a correlation line: `LETORA_REF: <uuid>` (stored on `tenancies.referencing_token`).
- Sending is blocked until at least one agency email is available (settings or override).

## Inbound (`POST /api/webhooks/inbound-email`)

1. Verifies the Resend/Svix webhook signature using `RESEND_WEBHOOK_SECRET`.
2. For Resend’s **`email.received`** event, the webhook payload includes **metadata only** (not the full body). The handler loads the full message with **`GET https://api.resend.com/emails/receiving/{email_id}`** using the same **`RESEND_API_KEY`** as outbound sends.
3. Extracts `LETORA_REF` from subject + body ([`extractReferencingTokenFromText`](../src/lib/referencing/inbound-utils.ts)).
4. Loads the tenancy by `referencing_token` and logs a row in **`referencing_events`** (direction `inbound`).
5. Always updates **`referencing_last_inbound_at`** on the tenancy.

**Dashboard setup:** In Resend → Webhooks, add `https://<your-app>/api/webhooks/inbound-email`, event **`email.received`**, and enable **receiving** on your domain (or `*.resend.app`). Replies must be addressed to the same **`RESEND_FROM_EMAIL`** domain you send from (or your configured receiving domain), so Resend can receive them and fire the webhook.

### Classification ([`classifyReferencingReply`](../src/lib/referencing/inbound-utils.ts))

- **Positive** (e.g. pass / cleared / satisfactory): sets `onboarding_status` to **`contract_sent`**, marks reference-type onboarding tasks complete (employment / previous landlord / credit check when present).
- **Negative** (e.g. fail / declined): logs only — **does not** auto-advance onboarding; the landlord should use **Mark referencing complete (manual)** or follow up with the agency.
- **Unknown** (ambiguous or neutral wording): logs only — **does not** auto-advance onboarding. The landlord should confirm manually when they have a final PDF/outcome.

Agency wording varies; keyword matching is best-effort. Manual completion remains the reliable path.

## Product positioning

- Letora does **not** run credit/reference checks; the **agency** does.
- Tenants are **not** given a Letora portal; communication is by **email** (welcome/onboarding) and the agency’s own process.
