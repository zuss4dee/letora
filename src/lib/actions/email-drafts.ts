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
  return { ok: true as const };
}
