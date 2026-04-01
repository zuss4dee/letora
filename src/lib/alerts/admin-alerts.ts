import { Resend } from "resend";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type SystemAlertInput = {
  alertType: string;
  message: string;
  errorDetails?: Database["public"]["Tables"]["system_alerts"]["Insert"]["error_details"];
};

export async function createSystemAlert(input: SystemAlertInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const payload: Database["public"]["Tables"]["system_alerts"]["Insert"] = {
    alert_type: input.alertType,
    message: input.message,
    error_details: input.errorDetails ?? null,
  };
  const { error } = await supabase.from("system_alerts").insert(payload);
  if (error) {
    throw new Error(`Failed to create system alert: ${error.message}`);
  }
}

export async function notifyAdminByEmail(params: {
  subject: string;
  body: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.ADMIN_EMAIL?.trim();
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !to || !fromAddress) {
    throw new Error("Missing RESEND_API_KEY, ADMIN_EMAIL, or RESEND_FROM_EMAIL");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `Letora System <${fromAddress}>`,
    to,
    subject: params.subject,
    text: params.body,
  });
  if (error) {
    throw new Error(`Failed to send admin alert email: ${error.message}`);
  }
}
