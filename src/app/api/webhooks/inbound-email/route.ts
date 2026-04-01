import { Webhook } from "svix";

import {
  classifyReferencingReply,
  extractReferencingTokenFromText,
} from "@/lib/referencing/inbound-utils";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function extractEmailText(payload: Record<string, unknown>): { text: string; subject: string } {
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

  const { text, subject } = extractEmailText(payload);
  const combined = `${subject}\n${text}`;
  const token = extractReferencingTokenFromText(combined);
  if (!token) {
    return Response.json({ ok: true, ignored: true, reason: "no_token" });
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
    raw_payload: { webhook_type: type, classification },
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
