import { Webhook } from "svix";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    message: "Resend delivery webhook is live. Configure in Resend dashboard for email.delivered, email.bounced, email.complained, email.opened events.",
  });
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
  const data = payload.data as Record<string, unknown> | undefined;
  const resendEmailId = typeof data?.email_id === "string" ? data.email_id : null;

  if (!resendEmailId) {
    return Response.json({ ok: true, ignored: true, reason: "no_email_id" });
  }

  const supabase = createServiceRoleClient();

  const updates: Record<string, unknown> = {};

  switch (type) {
    case "email.delivered":
      updates.delivery_status = "delivered";
      updates.delivered_at = new Date().toISOString();
      break;
    case "email.bounced":
      updates.delivery_status = "bounced";
      updates.bounced_at = new Date().toISOString();
      updates.bounce_reason = typeof data?.description === "string" ? data.description : null;
      break;
    case "email.complained":
      updates.delivery_status = "complained";
      break;
    case "email.opened":
      updates.opened_at = new Date().toISOString();
      break;
    default:
      return Response.json({ ok: true, ignored: true, reason: "unsupported_event_type", type });
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("email_logs")
      .update(updates)
      .eq("resend_email_id", resendEmailId);
  }

  return Response.json({ ok: true, type, emailId: resendEmailId });
}
