import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

/** Maps to user_settings.auto_send_* columns */
export type EmailAgentType = "rent_chaser" | "maintenance" | "onboarding" | "lead" | "referencing";

export { retryFailedEmail };

type SettingsRow = {
  email_from_name: string | null;
  auto_send_rent_chaser: boolean | null;
  auto_send_maintenance_updates: boolean | null;
  auto_send_onboarding_emails: boolean | null;
  auto_send_lead_updates: boolean | null;
  auto_send_referencing_emails: boolean | null;
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
    case "referencing":
      return settings.auto_send_referencing_emails === true;
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

export function generateUnsubscribeToken(): string {
  return randomUUID();
}

export function buildUnsubscribeUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";
  return `${baseUrl}/api/email/unsubscribe?token=${token}`;
}

type SendEmailParams = {
  to: string;
  toName: string;
  subject: string;
  body: string;
  agentType: EmailAgentType;
  html?: string;
  templateType?: string;
  templateVersion?: number;
  forceSend?: boolean;
};

type SendEmailResult = {
  sent: boolean;
  emailLogId: string;
  message: string;
  error?: string;
};

async function checkUnsubscribed(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await supabase
    .rpc("is_email_unsubscribed", { check_email: email.toLowerCase() })
    .single<boolean>();
  return data ?? false;
}

async function retryFailedEmail(supabase: SupabaseClient, logId: string): Promise<boolean> {
  const { data: log, error: fetchError } = await supabase
    .from("email_logs")
    .select("*")
    .eq("id", logId)
    .eq("status", "failed")
    .lt("retry_count", "max_retries")
    .single();

  if (fetchError || !log) return false;

  const retryCount = (log.retry_count ?? 0) + 1;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const resend = new Resend(apiKey);

  try {
    const from = buildResendFromHeader(log.email_from_name);
    const sendResult = await resend.emails.send({
      from,
      to: log.to_email,
      subject: log.subject,
      text: log.body,
      ...(log.html_body ? { html: log.html_body } : {}),
    });

    if (sendResult.error) {
      await supabase
        .from("email_logs")
        .update({
          retry_count: retryCount,
          next_retry_at: new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000).toISOString(),
          error_message: sendResult.error.message,
        })
        .eq("id", logId);
      return false;
    }

    await supabase
      .from("email_logs")
      .update({
        status: "sent",
        delivery_status: "sent",
        sent_at: new Date().toISOString(),
        resend_email_id: sendResult.data?.id,
        retry_count: retryCount,
        error_message: null,
      })
      .eq("id", logId);

    return true;
  } catch {
    await supabase
      .from("email_logs")
      .update({
        retry_count: retryCount,
        next_retry_at: new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000).toISOString(),
      })
      .eq("id", logId);
    return false;
  }
}

export async function sendEmail(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string | null,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const isUnsubscribed = await checkUnsubscribed(supabase, params.to);
  if (isUnsubscribed) {
    return {
      sent: false,
      emailLogId: "",
      message: `Email not sent — ${params.to} has unsubscribed`,
    };
  }

  const unsubscribeToken = generateUnsubscribeToken();

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
      html_body: params.html,
      template_type: params.templateType,
      template_version: params.templateVersion,
      status: "draft",
      delivery_status: "pending",
      unsubscribe_token: unsubscribeToken,
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
      "email_from_name,auto_send_rent_chaser,auto_send_maintenance_updates,auto_send_onboarding_emails,auto_send_lead_updates,auto_send_referencing_emails",
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
    auto_send_referencing_emails: false,
  };

  const allowSend = params.forceSend === true || isAutoSendEnabled(row, params.agentType);
  if (!allowSend) {
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
        delivery_status: "failed",
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
      .update({ status: "failed", delivery_status: "failed", error_message: msg })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return { sent: false, emailLogId, message: msg, error: msg };
  }

  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

  const resend = new Resend(apiKey);
  const sendResult = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.body,
    ...(params.html ? { html: params.html } : {}),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
    },
  });

  if (sendResult.error) {
    const errMsg = sendResult.error.message ?? "Resend rejected the send";
    await supabase
      .from("email_logs")
      .update({
        status: "failed",
        delivery_status: "failed",
        error_message: errMsg,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return {
      sent: false,
      emailLogId,
      message: "Failed to send email",
      error: errMsg,
    };
  }

  const resendMessageId = sendResult.data?.id?.trim();
  if (!resendMessageId) {
    const unexpected = "Resend returned no message id (unexpected response)";
    await supabase
      .from("email_logs")
      .update({
        status: "failed",
        delivery_status: "failed",
        error_message: unexpected,
      })
      .eq("id", emailLogId)
      .eq("user_id", userId);

    return {
      sent: false,
      emailLogId,
      message: "Email provider returned an unexpected response",
      error: unexpected,
    };
  }

  await supabase
    .from("email_logs")
    .update({
      status: "sent",
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
      resend_email_id: resendMessageId,
    })
    .eq("id", emailLogId)
    .eq("user_id", userId);

  return {
    sent: true,
    emailLogId,
    message: "Email sent successfully",
  };
}

/** @alias sendEmail — backward-compatible export for existing callers */
export const sendEmailTool = sendEmail;
