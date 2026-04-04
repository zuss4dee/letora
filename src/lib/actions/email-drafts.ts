"use server";

import { revalidatePath } from "next/cache";

import { buildResendFromHeader } from "@/lib/tools/send-email";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export type EmailDraftRow = {
  id: string;
  to_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  agent_type: string;
  status: string;
  created_at: string;
};

export type EmailDraftTableRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  tenant_name: string | null;
};

export async function getAllEmailDrafts(userId: string): Promise<EmailDraftTableRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_drafts")
    .select(`
      id, subject, body, status, created_at,
      tenants ( full_name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  console.log("[emails page] drafts:", data?.length, "error:", error?.message);

  if (error) {
    console.warn("[getAllEmailDrafts]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const raw = row.tenants as unknown;
    let tenantName: string | null = null;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      tenantName = (raw as { full_name?: string | null }).full_name ?? null;
    } else if (Array.isArray(raw) && raw.length > 0) {
      tenantName = (raw[0] as { full_name?: string | null }).full_name ?? null;
    }
    return {
      id: row.id as string,
      subject: row.subject as string,
      body: row.body as string,
      status: row.status as string,
      created_at: row.created_at as string,
      tenant_name: tenantName,
    };
  });
}

/** @deprecated Use getAllEmailDrafts for the /dashboard/emails page. This reads from email_logs (send infrastructure). */
export async function getAllEmailLogs(userId: string): Promise<EmailDraftRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_logs")
    .select("id,to_name,to_email,subject,body,agent_type,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[getAllEmailLogs]", error.message);
    return [];
  }
  return (data ?? []) as EmailDraftRow[];
}

export async function getPendingEmailDrafts(userId: string): Promise<EmailDraftRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_logs")
    .select("id,to_name,to_email,subject,body,agent_type,status,created_at")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("[getPendingEmailDrafts]", error.message);
    return [];
  }
  return (data ?? []) as EmailDraftRow[];
}

export async function sendEmailLogNow(logId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("email_logs")
    .select("id,user_id,status,to_email,to_name,subject,body")
    .eq("id", logId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !row || row.status !== "draft") {
    return { ok: false as const, error: "Draft not found or already sent" };
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("email_from_name")
    .eq("user_id", user.id)
    .maybeSingle<{ email_from_name: string | null }>();

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY is not configured" };
  }

  let from: string;
  try {
    from = buildResendFromHeader(settings?.email_from_name);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Invalid sender" };
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: row.to_email,
    subject: row.subject,
    text: row.body,
  });

  if (sendError) {
    await supabase
      .from("email_logs")
      .update({ status: "failed", error_message: sendError.message })
      .eq("id", logId)
      .eq("user_id", user.id);

    return { ok: false as const, error: sendError.message };
  }

  await supabase
    .from("email_logs")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", logId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
  return { ok: true as const };
}

export type ReviewEmailDraftResult = {
  id: string;
  to: string;
  subject: string;
  body: string;
};

/**
 * Loads a draft from `email_logs` for the review modal (send infrastructure).
 * For AI-generated drafts visible on /dashboard/emails, see `getAllEmailDrafts`.
 */
export async function reviewEmailDraft(draftId: string): Promise<ReviewEmailDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: row, error: fetchError } = await supabase
    .from("email_logs")
    .select("id,user_id,status,to_email,to_name,subject,body")
    .eq("id", draftId)
    .maybeSingle();

  if (fetchError || !row) {
    throw new Error("Draft not found");
  }
  if (row.user_id !== user.id) {
    throw new Error("Draft not found");
  }
  if (row.status !== "draft") {
    throw new Error("Draft not found or already sent");
  }

  const to = row.to_name?.trim()
    ? `${row.to_name.trim()} <${row.to_email}>`
    : row.to_email;

  return {
    id: row.id as string,
    to,
    subject: row.subject,
    body: row.body,
  };
}

/**
 * Sends a draft via Resend and marks it sent. Revalidates dashboard and maintenance routes.
 */
export async function sendEmailDraft(draftId: string): Promise<void> {
  const result = await sendEmailLogNow(draftId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath("/dashboard/maintenance");
}
