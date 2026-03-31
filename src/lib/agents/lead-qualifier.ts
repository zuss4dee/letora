import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
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
  property_id: string | null;
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
    .select("id,full_name,email,move_in_date,source,notes,property_id")
    .eq("user_id", userId)
    .eq("status", "new")
    .eq("qualified_status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  const propertyIds = [
    ...new Set(
      (data as LeadRow[])
        .map((l) => l.property_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: properties } =
    propertyIds.length > 0
      ? await supabase.from("properties").select("id, address").in("id", propertyIds)
      : { data: [] as { id: string; address: string | null }[] | null };

  const propById = new Map((properties ?? []).map((p) => [p.id, p] as const));

  const results: LeadQualifierResult[] = [];
  for (const lead of data as LeadRow[]) {
    const prop = lead.property_id ? propById.get(lead.property_id) : undefined;
    const fullName = lead.full_name ?? "Unknown";
    const email = lead.email ?? "";
    const propertyInterested =
      normalizePropertyAddressLabel(prop?.address ?? "") || "Unknown property";
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

    const nextQualified: "qualified" | "disqualified" =
      analysis.recommendation === "qualify" ? "qualified" : "disqualified";
    await supabase
      .from("leads")
      .update({
        qualified_status: nextQualified,
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
    await supabase.from("agent_runs").insert({
      user_id: userId,
      agent_type: "lead_qualifier",
      status: "completed",
      payload: {
        count: results.length,
      },
    });
    revalidatePath("/dashboard/leads");
  }

  return results;
}

