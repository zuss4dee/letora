import { Resend } from "resend";

export type SendRentChaseParams = {
  to: string;
  subject: string;
  body: string;
  /** Verified sender in Resend, e.g. Rent <onboarding@resend.dev> or your domain */
  from: string;
};

/**
 * @deprecated Phase 1 routes agent email through `sendEmailTool` (email_logs + toggles). Kept for legacy callers only.
 * Send a transactional rent reminder. Requires RESEND_API_KEY and a verified `from` domain in Resend.
 */
export async function sendRentChaseEmail(params: SendRentChaseParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
