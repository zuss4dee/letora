import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Maps to user_settings.auto_send_* columns */
export type EmailAgentType = "rent_chaser" | "maintenance" | "onboarding" | "lead";

export type SendEmailToolParams = {
  to: string;
  toName: string;
  subject: string;
  body: string;
  agentType: EmailAgentType;
};

export type SendEmailToolResult = {
  sent: boolean;
  emailLogId: string;
  message: string;
  error?: string;
};

type SettingsRow = {
  email_from_name: string | null;
  auto_send_rent_chaser: boolean | null;
  auto_send_maintenance_updates: boolean | null;
  auto_send_onboarding_emails: boolean | null;
  auto_send_lead_updates: boolean | null;
};

function isAutoSendEnabled(settings: SettingsRow, agentType: EmailAgentType): boolean {
  switch (agentType) {
    case "rent_chaser":
      return settings.auto_send_rent_chaser === true;
    case "maintenance":
      return settings.auto_send_maintenance_updates === true;
    case "onboarding":
      return settings.auto_send_onboarding_emails === true;
    case "lead":
      return settings.auto_send_lead_updates === true;
    default:
      return false;
  }
}

export function buildResendFromHeader(emailFromName: string | null | undefined): string {
  const address = process.env.RESEND_FROM_EMAIL?.trim();
  if (!address) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }
  const name = (emailFromName ?? "").trim() || "Letora";
  return `${name} <${address}>`;
}

/**
 * Central email path: always creates email_logs (draft first), then sends via Resend only if auto-send is on.
 * When auto-send is off, status stays `draft` for the Pending Email Drafts widget.
 */
export async function sendEmailTool(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string | null,
  params: SendEmailToolParams,
): Promise<SendEmailToolResult> {
  const { data: inserted, error: insertError } = await supabase
    .from("email_logs")
    .insert({
      user_id: userId,
      agent_run_id: agentRunId,
      agent_type: params.agentType,
      to_email: params.to,
      to_name: params.toName,
      subject: params.subject,
      body: params.body,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      sent: false,
      emailLogId: "",
      message: "Failed to save email draft",
      error: insertError?.message ?? "insert failed",
    };
  }

  const emailLogId = inserted.id as string;

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select(
      "email_from_name,auto_send_rent_chaser,auto_send_maintenance_updates,auto_send_onboarding_emails,auto_send_lead_updates",
    )
    .eq("user_id", userId)
    .maybeSingle<SettingsRow>();

  if (settingsError) {
    return {
      sent: false,
      emailLogId,
      message: "Draft saved — could not load settings to send",
      error: settingsError.message,
    };
  }

  const row = settings ?? {
    email_from_name: null,
    auto_send_rent_chaser: false,
    auto_send_maintenance_updates: false,
    auto_send_onboarding_emails: false,
    auto_send_lead_updates: false,
  };

  if (!isAutoSendEnabled(row, params.agentType)) {
    return {
      sent: false,
      emailLogId,
      message: "Draft saved — review in Pending Email Drafts (auto-send is off)",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    await supabase
      .from("email_logs")
      .update({
        status: "failed",
        error_message: "RESEND_API_KEY is not configured",
      })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return {
      sent: false,
      emailLogId,
      message: "Auto-send is on but email provider is not configured",
      error: "Missing RESEND_API_KEY",
    };
  }

  let from: string;
  try {
    from = buildResendFromHeader(row.email_from_name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid from address";
    await supabase
      .from("email_logs")
      .update({ status: "failed", error_message: msg })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return { sent: false, emailLogId, message: msg, error: msg };
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  if (sendError) {
    await supabase
      .from("email_logs")
      .update({
        status: "failed",
        error_message: sendError.message,
      })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return {
      sent: false,
      emailLogId,
      message: "Failed to send email",
      error: sendError.message,
    };
  }

  await supabase
    .from("email_logs")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", emailLogId)
    .eq("user_id", userId);

  return {
    sent: true,
    emailLogId,
    message: "Email sent successfully",
  };
}
