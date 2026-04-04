"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { sendEmailTool } from "@/lib/tools/send-email";

export type ReferencingEventRow = {
  id: string;
  direction: string;
  subject: string | null;
  bodyPreview: string | null;
  outcome: string | null;
  createdAt: string | null;
};

export async function getReferencingEvents(
  userId: string,
  tenancyId: string,
): Promise<ReferencingEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referencing_events")
    .select("id, direction, subject, body_preview, outcome, created_at")
    .eq("user_id", userId)
    .eq("tenancy_id", tenancyId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    direction: String(r.direction),
    subject: (r.subject as string | null) ?? null,
    bodyPreview: (r.body_preview as string | null) ?? null,
    outcome: (r.outcome as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
  }));
}

/**
 * Core handoff logic (session or service-role client). Used by dashboard action and CEO executor.
 */
export async function runReferencingHandoffForUser(
  tenancyId: string,
  userId: string,
  supabase: SupabaseClient,
  options?: { forceSend?: boolean },
): Promise<
  | { ok: true; emailLogId: string; message: string; sent: boolean }
  | { ok: false; error: string }
> {
  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "contact_email,landlord_name,referencing_agency_name,referencing_agency_email,referencing_agency_notes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      start_date,
      move_in_date,
      referencing_token,
      referencing_agency_email_override,
      properties!inner ( address, city, postcode, user_id ),
      tenants ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenErr || !tenancy) return { ok: false, error: "Tenancy not found" };

  const prop = tenancy.properties as unknown as {
    address: string | null;
    city: string | null;
    postcode: string | null;
    user_id: string;
  };
  if (prop.user_id !== userId) return { ok: false, error: "Not found" };

  const tenantRaw = tenancy.tenants as unknown as
    | { full_name: string | null; email: string | null; phone: string | null }
    | { full_name: string | null; email: string | null; phone: string | null }[]
    | null;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;

  const agencyEmail =
    (tenancy.referencing_agency_email_override as string | null)?.trim() ||
    (settings?.referencing_agency_email as string | null)?.trim() ||
    "";
  if (!agencyEmail) {
    return {
      ok: false,
      error:
        "Set a referencing agency email in Settings (Referencing) or add an override on this tenancy.",
    };
  }

  let token = tenancy.referencing_token as string | null;
  if (!token) {
    token = crypto.randomUUID();
    const { error: upTok } = await supabase
      .from("tenancies")
      .update({ referencing_token: token })
      .eq("id", tenancyId);
    if (upTok) return { ok: false, error: upTok.message };
  }

  const agencyName =
    (settings?.referencing_agency_name as string | null)?.trim() || "team";
  const addressLabel = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");
  const landlordContact = (settings?.contact_email as string | null)?.trim() || "";
  const notes = (settings?.referencing_agency_notes as string | null)?.trim();

  const subject = `Referencing request — ${tenant?.full_name ?? "Tenant"} — ${addressLabel || "Property"}`;
  const body = [
    `Dear ${agencyName},`,
    "",
    "Please find details for a new tenant referencing request.",
    "",
    `LETORA_REF: ${token}`,
    "",
    "Tenant",
    `Name: ${tenant?.full_name ?? "—"}`,
    `Email: ${tenant?.email ?? "—"}`,
    `Phone: ${tenant?.phone ?? "—"}`,
    "",
    "Property",
    addressLabel || "—",
    "",
    `Tenancy start: ${(tenancy.start_date as string | null) ?? "—"}`,
    `Move-in: ${(tenancy.move_in_date as string | null) ?? "—"}`,
    "",
    "Landlord contact (reply-to)",
    landlordContact || "—",
    "",
    notes ? `Notes: ${notes}` : null,
    "",
    "When referencing is complete, reply to this thread or reference the LETORA_REF line above.",
    "",
    "Kind regards,",
    (settings?.landlord_name as string | null)?.trim() || "Landlord",
  ]
    .filter(Boolean)
    .join("\n");

  const sendResult = await sendEmailTool(supabase, userId, null, {
    to: agencyEmail,
    toName: agencyName,
    subject,
    body,
    agentType: "referencing",
    forceSend: options?.forceSend === true,
  });

  const now = new Date().toISOString();
  await supabase
    .from("tenancies")
    .update({ referencing_last_outbound_at: now })
    .eq("id", tenancyId);

  await supabase.from("referencing_events").insert({
    user_id: userId,
    tenancy_id: tenancyId,
    direction: "outbound",
    email_log_id: sendResult.emailLogId || null,
    subject,
    body_preview: body.slice(0, 500),
    outcome: sendResult.sent ? "sent" : "draft",
  });

  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
  revalidatePath("/dashboard/tenancies");

  return {
    ok: true,
    emailLogId: sendResult.emailLogId,
    message: sendResult.message,
    sent: sendResult.sent,
  };
}

export async function sendReferencingHandoff(tenancyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  /** Explicit dashboard click — always attempt Resend (same as CEO-confirmed send). Auto-send toggle only gates automated/agent sends without confirmation. */
  const result = await runReferencingHandoffForUser(tenancyId, user.id, supabase, { forceSend: true });
  if (!result.ok) return result;
  return {
    ok: true as const,
    emailLogId: result.emailLogId,
    message: result.message,
    sent: result.sent,
  };
}

export async function updateReferencingAgencyOverride(tenancyId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, properties!inner(user_id)")
    .eq("id", tenancyId)
    .maybeSingle();

  if (error || !tenancy) return { ok: false as const, error: "Tenancy not found" };
  const p = tenancy.properties as unknown as { user_id: string };
  if (p.user_id !== user.id) return { ok: false as const, error: "Not found" };

  const trimmed = email.trim();
  const { error: upErr } = await supabase
    .from("tenancies")
    .update({ referencing_agency_email_override: trimmed.length > 0 ? trimmed : null })
    .eq("id", tenancyId);

  if (upErr) return { ok: false as const, error: upErr.message };

  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
  return { ok: true as const };
}

export async function markReferencingCompleteManual(tenancyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, properties!inner(user_id)")
    .eq("id", tenancyId)
    .maybeSingle();

  if (error || !tenancy) return { ok: false as const, error: "Tenancy not found" };
  const p = tenancy.properties as unknown as { user_id: string };
  if (p.user_id !== user.id) return { ok: false as const, error: "Not found" };

  const { error: upErr } = await supabase
    .from("tenancies")
    .update({
      onboarding_status: "contract_sent",
      referencing_last_inbound_at: new Date().toISOString(),
    })
    .eq("id", tenancyId);

  if (upErr) return { ok: false as const, error: upErr.message };

  await supabase.from("referencing_events").insert({
    user_id: user.id,
    tenancy_id: tenancyId,
    direction: "inbound",
    subject: null,
    body_preview: "Marked complete manually in dashboard",
    outcome: "manual_complete",
  });

  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
  revalidatePath("/dashboard/tenancies");
  return { ok: true as const };
}
