import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailAgentType } from "@/lib/tools/send-email";
import { sendEmail } from "@/lib/tools/send-email";
import { renderEmailTemplate } from "@/components/email/templates/registry";
import type { EmailTemplateType } from "@/components/email/templates";

type TemplateEmailResult = {
  sent: boolean;
  emailLogId: string;
  message: string;
  error?: string;
};

export async function sendTemplateEmail(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string | null,
  templateType: EmailTemplateType,
  props: Record<string, unknown>,
  agentType: EmailAgentType,
  forceSend = false,
): Promise<TemplateEmailResult> {
  const rendered = await renderEmailTemplate(templateType, props);

  const to = (props.to as string) ?? (props.tenantEmail as string) ?? (props.leadEmail as string) ?? "";
  const toName = (props.toName as string) ?? (props.tenantName as string) ?? (props.leadName as string) ?? "";

  if (!to) {
    return {
      sent: false,
      emailLogId: "",
      message: "No recipient email address provided",
      error: "Missing recipient",
    };
  }

  return sendEmail(supabase, userId, agentRunId, {
    to,
    toName,
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
    agentType,
    templateType,
    forceSend,
  });
}
