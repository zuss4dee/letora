import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function retryFailedEmails() {
  const supabase = createServiceRoleClient();

  const { data: failedEmails, error: fetchError } = await supabase
    .from("email_logs")
    .select("*")
    .eq("status", "failed")
    .lt("retry_count", "max_retries")
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .limit(50);

  if (fetchError || !failedEmails?.length) {
    return { retried: 0, errors: [] };
  }

  const results = await Promise.all(
    failedEmails.map(async (email) => {
      const retryCount = (email.retry_count ?? 0) + 1;
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (!apiKey) return { id: email.id, success: false, error: "Missing API key" };

      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      try {
        const from = `${email.email_from_name || "Letora"} <${process.env.RESEND_FROM_EMAIL}>`;
        const sendResult = await resend.emails.send({
          from,
          to: email.to_email,
          subject: email.subject,
          text: email.body,
          ...(email.html_body ? { html: email.html_body } : {}),
        });

        if (sendResult.error) {
          await supabase
            .from("email_logs")
            .update({
              retry_count: retryCount,
              next_retry_at: new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000).toISOString(),
              error_message: sendResult.error.message,
            })
            .eq("id", email.id);
          return { id: email.id, success: false, error: sendResult.error.message };
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
          .eq("id", email.id);

        return { id: email.id, success: true };
      } catch (err) {
        await supabase
          .from("email_logs")
          .update({
            retry_count: retryCount,
            next_retry_at: new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000).toISOString(),
          })
          .eq("id", email.id);
        return { id: email.id, success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    }),
  );

  const retried = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success);

  return { retried, errors };
}
