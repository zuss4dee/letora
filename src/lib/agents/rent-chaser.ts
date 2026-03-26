import { GoogleGenerativeAI } from "@google/generative-ai";

import { createClient } from "@/lib/supabase/server";

export interface AgentResult {
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  amountOwed: number;
  daysOverdue: number;
  emailSubject: string;
  emailBody: string;
  actionId: string;
}

type PaymentRow = {
  id: string;
  due_date: string | null;
  amount_due: number | string | null;
  amount_paid?: number | string | null;
  tenancies: {
    tenant_profiles: { full_name: string | null; email: string | null } | null;
    properties: { address: string | null; city: string | null; user_id: string | null } | null;
  } | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function getDaysOverdue(dueDateIso: string | null) {
  if (!dueDateIso) return 0;
  const due = new Date(`${dueDateIso}T00:00:00.000Z`);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor(diffMs / oneDayMs));
}

async function generateEmailDraft(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  tenantName: string,
  propertyAddress: string,
  amountOwed: number,
  daysOverdue: number,
) {
  const prompt = `You are a professional UK letting agent. Write a firm but polite rent chase email.
Tenant name: ${tenantName}
Property address: ${propertyAddress}
Amount owed: £${amountOwed}
Days overdue: ${daysOverdue}

Return ONLY valid JSON in this exact format:
{
  "subject": "email subject line here",
  "body": "full email body here"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { subject?: string; body?: string }) : {};

  return {
    subject: parsed.subject?.trim() || "Outstanding rent payment reminder",
    body:
      parsed.body?.trim() ||
      "Please contact us regarding your outstanding rent payment as soon as possible.",
  };
}

export async function runRentChaserAgent(userId: string): Promise<AgentResult[]> {
  const supabase = await createClient();
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      "id,due_date,amount_due,amount_paid,status,tenancies(tenant_profiles(full_name,email),properties(address,city,user_id))",
    )
    .in("status", ["overdue", "pending"])
    .lte("due_date", today)
    .eq("tenancies.properties.user_id", userId)
    .order("due_date", { ascending: true });

  if (error || !data) {
    return [];
  }

  const filtered = (data as PaymentRow[]).filter((row) => {
    const tenancy = row.tenancies;
    return Boolean(tenancy?.tenant_profiles?.email && tenancy?.properties?.address);
  });

  if (filtered.length === 0) return [];

  const results: AgentResult[] = [];

  for (const row of filtered) {
    const tenantName = row.tenancies?.tenant_profiles?.full_name ?? "Tenant";
    const tenantEmail = row.tenancies?.tenant_profiles?.email ?? "";
    const address = row.tenancies?.properties?.address ?? "Property";
    const city = row.tenancies?.properties?.city;
    const propertyAddress = city ? `${address}, ${city}` : address;
    const amountOwed = Math.max(0, toNumber(row.amount_due) - toNumber(row.amount_paid));
    const daysOverdue = getDaysOverdue(row.due_date);

    const draft = await generateEmailDraft(model, tenantName, propertyAddress, amountOwed, daysOverdue);

    const payload = {
      rentPaymentId: row.id,
      tenantName,
      tenantEmail,
      propertyAddress,
      amountOwed,
      daysOverdue,
      emailSubject: draft.subject,
      emailBody: draft.body,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("agent_actions")
      .insert({
        user_id: userId,
        agent_type: "rent_chaser",
        status: "draft",
        payload,
      })
      .select("id")
      .single();

    if (insertError || !inserted) continue;

    results.push({
      tenantName,
      tenantEmail,
      propertyAddress,
      amountOwed,
      daysOverdue,
      emailSubject: draft.subject,
      emailBody: draft.body,
      actionId: inserted.id,
    });
  }

  return results;
}

