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
  property_id: string | null;
  tenant_id: string | null;
  due_date: string | null;
  amount: number | string | null;
  status: string | null;
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
  settings: {
    businessName: string;
    landlordName: string;
    tone: string;
    signoff: string;
    includePaymentPlan: boolean;
    instructions: string;
  },
) {
  const prompt = `You are a professional UK letting agent. Write a rent chase email.
Tenant name: ${tenantName}
Property address: ${propertyAddress}
Amount owed: £${amountOwed}
Days overdue: ${daysOverdue}
Business name: ${settings.businessName}
Landlord name: ${settings.landlordName}
Communication tone: ${settings.tone}
Preferred sign-off: ${settings.signoff}
Include payment plan offer: ${settings.includePaymentPlan ? "Yes" : "No"}
Custom instructions: ${settings.instructions || "None"}

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedUserId = user?.id ?? userId;
  if (!resolvedUserId) return [];
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const today = new Date().toISOString().split("T")[0];
  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "business_name,landlord_name,contact_email,rent_chaser_tone,email_signoff,include_payment_plan,rent_chaser_instructions",
    )
    .eq("user_id", resolvedUserId)
    .maybeSingle<{
      business_name: string | null;
      landlord_name: string | null;
      contact_email: string | null;
      rent_chaser_tone: string | null;
      email_signoff: string | null;
      include_payment_plan: boolean | null;
      rent_chaser_instructions: string | null;
    }>();

  const landlordFallbackEmail =
    settings?.contact_email?.trim() || user?.email?.trim() || "";

  const promptSettings = {
    businessName: settings?.business_name ?? "Letora Property Management",
    landlordName: settings?.landlord_name ?? "Landlord",
    tone: settings?.rent_chaser_tone ?? "professional_firm",
    signoff: settings?.email_signoff ?? "Kind regards",
    includePaymentPlan: settings?.include_payment_plan ?? true,
    instructions: settings?.rent_chaser_instructions ?? "",
  };

  const { data: overdueData, error: overdueError } = await supabase
    .from("rent_payments")
    .select("id,property_id,tenant_id,amount,due_date,status")
    .eq("user_id", resolvedUserId)
    .eq("status", "overdue");

  const { data: pendingData, error: pendingError } = await supabase
    .from("rent_payments")
    .select("id,property_id,tenant_id,amount,due_date,status")
    .eq("user_id", resolvedUserId)
    .eq("status", "pending")
    .lt("due_date", today);

  if (overdueError || pendingError) {
    return [];
  }

  console.log(
    "[RentChaser] Found candidates:",
    overdueData?.length ?? 0,
    "overdue,",
    pendingData?.length ?? 0,
    "pending",
  );

  const merged = [...(overdueData ?? []), ...(pendingData ?? [])] as PaymentRow[];
  const seenIds = new Set<string>();
  const candidates = merged.filter((row) => {
    if (seenIds.has(row.id)) return false;
    seenIds.add(row.id);
    return true;
  });

  const propertyIds = candidates
    .map((row) => row.property_id)
    .filter((id): id is string => Boolean(id));
  const tenantIds = candidates
    .map((row) => row.tenant_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,address,city")
      .in("id", propertyIds.length ? propertyIds : ["none"]),
    supabase
      .from("tenant_profiles")
      .select("id,full_name,email")
      .in("id", tenantIds.length ? tenantIds : ["none"]),
  ]);

  // Include all payment rows Rent Tracker would treat as chaseable. Do not require tenant email —
  // Rent Tracker can show "Unknown tenant" when tenant_id is missing; we still draft a chase and
  // use landlord contact / account email for mailto when needed.
  const filtered = candidates
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map((row) => {
      const property = properties?.find((p) => p.id === row.property_id);
      const tenant = tenants?.find((t) => t.id === row.tenant_id);
      return { row, property, tenant };
    });

  if (filtered.length === 0) return [];

  const results: AgentResult[] = [];

  for (const entry of filtered) {
    const { row, property, tenant } = entry;
    const tenantName = tenant?.full_name ?? "Unknown tenant";
    const tenantEmail =
      tenant?.email?.trim() || landlordFallbackEmail;
    const address = property?.address ?? "Unknown property";
    const city = property?.city;
    const propertyAddress = city ? `${address}, ${city}` : address;
    const amountOwed = Math.max(0, toNumber(row.amount));
    const daysOverdue = getDaysOverdue(row.due_date);

    const draft = await generateEmailDraft(
      model,
      tenantName,
      propertyAddress,
      amountOwed,
      daysOverdue,
      promptSettings,
    );

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
      .from("agent_runs")
      .insert({
        user_id: resolvedUserId,
        agent_type: "rent_chaser",
        status: "draft",
        payload,
      })
      .select("id")
      .single();

    if (insertError || !inserted) continue;

    // Promote pending-but-past-due payments to overdue after chasing.
    if ((row.status ?? "").toLowerCase() === "pending") {
      await supabase
        .from("rent_payments")
        .update({ status: "overdue" })
        .eq("id", row.id)
        .eq("user_id", resolvedUserId);
    }

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

