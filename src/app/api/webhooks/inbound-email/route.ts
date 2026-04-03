/**
 * Resend inbound webhook: correlate replies that include LETORA_REF to a tenancy.
 * - Always logs referencing_events and updates referencing_last_inbound_at.
 * - Auto-advances onboarding (contract_sent + completes reference tasks) only when
 *   classifyReferencingReply === "positive". Negative or unknown → log only; landlord
 *   confirms manually. See docs/referencing-inbound.md.
 *
 * **Webhook URL in Resend:** use your **canonical** host (often `www.`). If Vercel
 * redirects apex → www, pointing the webhook at `https://example.com/...` returns **307**
 * and Resend will not treat the delivery as successful — use `https://www.example.com/...`.
 */
import { Webhook } from "svix";

import { fetchResendReceivedEmail } from "@/lib/referencing/fetch-resend-received-email";
import {
  classifyReferencingReply,
  extractReferencingTokenFromText,
} from "@/lib/referencing/inbound-utils";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Lets you verify the route is reachable on the canonical domain (GET is not redirected like apex→www POST issues). */
export async function GET() {
  return Response.json({
    ok: true,
    message:
      "Inbound email webhook is live. Resend must POST here with Svix headers (email.received).",
  });
}

/** Inline body from webhook (older payloads); Resend usually omits body — use `email_id` + API. */
function extractInlineEmailText(payload: Record<string, unknown>): { text: string; subject: string } {
  const data = payload.data as Record<string, unknown> | undefined;
  const record = payload.record as Record<string, unknown> | undefined;
  const subject =
    (typeof data?.subject === "string" && data.subject) ||
    (typeof record?.subject === "string" && record.subject) ||
    "";
  const text =
    (typeof data?.text === "string" && data.text) ||
    (typeof data?.body === "string" && data.body) ||
    (typeof record?.text === "string" && record.text) ||
    (typeof record?.html === "string" && record.html) ||
    "";
  return { text: `${subject}\n${text}`, subject };
}

/**
 * Resend `email.received` webhooks include metadata only; body must be loaded via
 * GET /emails/receiving/:id (same RESEND_API_KEY as outbound).
 */
async function resolveInboundCombinedText(payload: Record<string, unknown>): Promise<{
  combined: string;
  subject: string;
  source: "inline" | "resend_api";
}> {
  const data = payload.data as Record<string, unknown> | undefined;
  const emailId = typeof data?.email_id === "string" ? data.email_id.trim() : "";
  const subjectMeta = typeof data?.subject === "string" ? data.subject : "";

  if (emailId) {
    const fetched = await fetchResendReceivedEmail(emailId);
    if (fetched) {
      const combined = `${fetched.subject || subjectMeta}\n${fetched.text}`;
      return {
        combined,
        subject: fetched.subject || subjectMeta,
        source: "resend_api",
      };
    }
  }

  const inline = extractInlineEmailText(payload);
  return { combined: inline.text, subject: inline.subject, source: "inline" };
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "RESEND_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing Svix signature headers" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  if (type && type !== "email.received") {
    return Response.json({ ok: true, ignored: true, reason: "unsupported_event_type", type });
  }

  const { combined, subject, source } = await resolveInboundCombinedText(payload);
  const token = extractReferencingTokenFromText(combined);
  if (!token) {
    return Response.json({
      ok: true,
      ignored: true,
      reason: "no_token",
      hint: "Ensure LETORA_REF appears in the reply body or subject; inbound body may require RESEND_API_KEY fetch.",
      content_source: source,
    });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return Response.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { data: tenancy, error: findErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      onboarding_status,
      properties!inner ( user_id )
    `,
    )
    .eq("referencing_token", token)
    .maybeSingle();

  if (findErr || !tenancy) {
    return Response.json({ ok: true, ignored: true, reason: "tenancy_not_found" });
  }

  const prop = tenancy.properties as unknown as { user_id: string };
  const userId = prop.user_id;
  const tenancyId = tenancy.id as string;

  const classification = classifyReferencingReply(combined);
  const outcome =
    classification === "positive"
      ? "positive_keywords"
      : classification === "negative"
        ? "negative_keywords"
        : "unknown";

  const preview = combined.slice(0, 500);
  const now = new Date().toISOString();

  await supabase.from("referencing_events").insert({
    user_id: userId,
    tenancy_id: tenancyId,
    direction: "inbound",
    subject: subject || null,
    body_preview: preview,
    raw_payload: { webhook_type: type, classification, content_source: source },
    outcome,
  });

  const tenancyUpdates: Record<string, unknown> = { referencing_last_inbound_at: now };
  if (classification === "positive") {
    tenancyUpdates.onboarding_status = "contract_sent";
  }
  await supabase.from("tenancies").update(tenancyUpdates).eq("id", tenancyId);

  if (classification === "positive") {
    const refTaskNames = [
      "Employment reference request",
      "Previous landlord reference",
      "Credit check",
    ];
    await supabase
      .from("onboarding_tasks")
      .update({
        status: "complete",
        completed_at: now,
      })
      .eq("tenancy_id", tenancyId)
      .eq("user_id", userId)
      .in("task_name", refTaskNames)
      .eq("status", "pending");
  }

  return Response.json({ ok: true, tenancyId, classification });
}
