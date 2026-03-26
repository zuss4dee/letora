import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export interface LeadQualifierResult {
  leadId: string;
  fullName: string;
  email: string;
  propertyInterested: string;
  source: string;
  score: number;
  recommendation: "qualify" | "reject";
  reasoning: string;
  actionId: string;
}

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  move_in_date: string | null;
  source: string | null;
  notes: string | null;
  /** Supabase may type this as a one-element array for FK joins. */
  properties: { address: string | null; city: string | null } | { address: string | null; city: string | null }[] | null;
};

function parseRecommendation(value: string | undefined): "qualify" | "reject" {
  return value?.toLowerCase() === "qualify" ? "qualify" : "reject";
}

function clampScore(score: number | undefined): number {
  if (typeof score !== "number" || Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function scoreLead(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  lead: LeadRow,
) {
  const prompt = `You are a UK letting agent. Score this rental lead out of 100 and recommend qualify or reject.
Lead name: ${lead.full_name ?? "Unknown"}
Move-in date: ${lead.move_in_date ?? "Unknown"}
Source: ${lead.source ?? "Unknown"}
Notes: ${lead.notes ?? "None"}
Return ONLY valid JSON: { score: number, recommendation: 'qualify' | 'reject', reasoning: string }`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch
    ? (JSON.parse(jsonMatch[0]) as {
        score?: number;
        recommendation?: string;
        reasoning?: string;
      })
    : {};

  return {
    score: clampScore(parsed.score),
    recommendation: parseRecommendation(parsed.recommendation),
    reasoning: parsed.reasoning?.trim() || "No reasoning provided.",
  };
}

export async function runLeadQualifierAgent(userId: string): Promise<LeadQualifierResult[]> {
  const supabase = await createClient();
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const { data, error } = await supabase
    .from("leads")
    .select("id,full_name,email,move_in_date,source,notes,properties(address,city)")
    .eq("user_id", userId)
    .eq("status", "new")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  const results: LeadQualifierResult[] = [];
  for (const lead of data as LeadRow[]) {
    const prop = Array.isArray(lead.properties) ? lead.properties[0] : lead.properties;
    const fullName = lead.full_name ?? "Unknown";
    const email = lead.email ?? "";
    const address = prop?.address ?? "Unknown property";
    const city = prop?.city;
    const propertyInterested = city ? `${address}, ${city}` : address;
    const source = lead.source ?? "Unknown";

    const analysis = await scoreLead(model, lead);
    const payload = {
      leadId: lead.id,
      fullName,
      email,
      propertyInterested,
      source,
      score: analysis.score,
      recommendation: analysis.recommendation,
      reasoning: analysis.reasoning,
    };

    const { data: action, error: insertError } = await supabase
      .from("agent_actions")
      .insert({
        user_id: userId,
        agent_type: "lead_qualifier",
        status: "draft",
        payload,
      })
      .select("id")
      .single();

    if (insertError || !action) continue;

    // Move lead into the correct bucket on /dashboard/leads (qualified vs rejected).
    const nextStatus: "qualified" | "rejected" =
      analysis.recommendation === "qualify" ? "qualified" : "rejected";
    await supabase
      .from("leads")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("user_id", userId);

    results.push({
      leadId: lead.id,
      fullName,
      email,
      propertyInterested,
      source,
      score: analysis.score,
      recommendation: analysis.recommendation,
      reasoning: analysis.reasoning,
      actionId: action.id,
    });
  }

  if (results.length > 0) {
    revalidatePath("/dashboard/leads");
  }

  return results;
}

