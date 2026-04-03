/**
 * Resend inbound webhooks omit body text; fetch full content by email_id.
 * @see https://resend.com/docs/api-reference/emails/retrieve-received-email
 */
export type ResendReceivedEmailPayload = {
  subject: string;
  text: string;
};

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchResendReceivedEmail(emailId: string): Promise<ResendReceivedEmailPayload | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[resend-inbound] RESEND_API_KEY is not set; cannot fetch received email body");
    return null;
  }

  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[resend-inbound] Failed to fetch received email", {
      emailId,
      status: res.status,
      body: errText.slice(0, 500),
    });
    return null;
  }

  const raw = (await res.json()) as Record<string, unknown>;
  const subject = typeof raw.subject === "string" ? raw.subject : "";
  let text = "";
  if (typeof raw.text === "string" && raw.text.trim()) {
    text = raw.text;
  } else if (typeof raw.html === "string" && raw.html.trim()) {
    text = stripHtmlToPlain(raw.html);
  }

  return { subject, text };
}
