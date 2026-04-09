import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePropertyAddressLabel } from "@/lib/property-address";

/** Synced into `agent_runs` for dashboard alerts + assistant digest. */
export const PORTFOLIO_HEALTH_AGENT_TYPE = "portfolio_health_compliance";

export type ExpiredComplianceItem = {
  propertyId: string;
  propertyAddress: string;
  certificateType: string;
};

export type PortfolioHealthAlertPayload = {
  type: "compliance_expired";
  priority: "high";
  propertyId: string;
  propertyAddress: string;
  certificateType: string;
};

export type PortfolioHealthAlertRow = {
  id: string;
  created_at: string | null;
  payload: PortfolioHealthAlertPayload | null;
};

function formatPropertyLine(row: {
  address: string | null;
  postcode: string | null;
  city: string | null;
}): string {
  const addr = normalizePropertyAddressLabel(row.address ?? "") || "";
  const pc = (row.postcode ?? "").trim();
  const city = (row.city ?? "").trim();
  const tail = [city, pc].filter(Boolean).join(", ");
  const parts = [addr, tail].filter(Boolean);
  return parts.join(", ") || "Property";
}

/**
 * Scans `compliance_records` for **expired** rows and replaces dashboard alert rows
 * in `agent_runs` for this user. Idempotent per call — safe to run on layout load and before chat.
 */
export async function checkPortfolioHealth(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ expired: ExpiredComplianceItem[] }> {
  const { data: props, error: pErr } = await supabase
    .from("properties")
    .select("id, address, postcode, city")
    .eq("user_id", userId);

  if (pErr || !props?.length) {
    await supabase
      .from("agent_runs")
      .delete()
      .eq("user_id", userId)
      .eq("agent_type", PORTFOLIO_HEALTH_AGENT_TYPE);
    return { expired: [] };
  }

  const idToLine = new Map<string, string>();
  for (const p of props as { id: string; address: string | null; postcode: string | null; city: string | null }[]) {
    idToLine.set(p.id, formatPropertyLine(p));
  }

  const propertyIds = [...idToLine.keys()];
  const { data: compRows, error: cErr } = await supabase
    .from("compliance_records")
    .select("property_id, type")
    .in("property_id", propertyIds)
    .eq("status", "expired");

  if (cErr) {
    console.error("[checkPortfolioHealth] compliance query", cErr.message);
    await supabase
      .from("agent_runs")
      .delete()
      .eq("user_id", userId)
      .eq("agent_type", PORTFOLIO_HEALTH_AGENT_TYPE);
    return { expired: [] };
  }

  const expired: ExpiredComplianceItem[] = (compRows ?? []).map((r) => {
    const pid = r.property_id as string;
    const certType = String(r.type ?? "Certificate");
    return {
      propertyId: pid,
      propertyAddress: idToLine.get(pid) ?? "Property",
      certificateType: certType,
    };
  });

  await supabase
    .from("agent_runs")
    .delete()
    .eq("user_id", userId)
    .eq("agent_type", PORTFOLIO_HEALTH_AGENT_TYPE);

  if (expired.length === 0) {
    return { expired: [] };
  }

  const inserts = expired.map((e) => ({
    user_id: userId,
    agent_type: PORTFOLIO_HEALTH_AGENT_TYPE,
    status: "open",
    payload: {
      type: "compliance_expired" as const,
      priority: "high" as const,
      propertyId: e.propertyId,
      propertyAddress: e.propertyAddress,
      certificateType: e.certificateType,
    },
  }));

  const { error: insErr } = await supabase.from("agent_runs").insert(inserts);
  if (insErr) {
    console.error("[checkPortfolioHealth] insert agent_runs", insErr.message);
  }

  return { expired };
}

export async function getPortfolioHealthAlertsForUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<PortfolioHealthAlertRow[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("agent_type", PORTFOLIO_HEALTH_AGENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row) => {
    const raw = row.payload as Record<string, unknown> | null;
    const payload: PortfolioHealthAlertPayload | null =
      raw &&
      raw.type === "compliance_expired" &&
      typeof raw.propertyId === "string" &&
      typeof raw.certificateType === "string"
        ? {
            type: "compliance_expired",
            priority: "high",
            propertyId: raw.propertyId,
            propertyAddress: typeof raw.propertyAddress === "string" ? raw.propertyAddress : "Property",
            certificateType: raw.certificateType,
          }
        : null;
    return {
      id: row.id as string,
      created_at: (row.created_at as string) ?? null,
      payload,
    };
  });
}

/**
 * Injected into the CEO system prompt when expired certificates exist.
 */
export function formatPortfolioHealthDigestForAssistant(expired: ExpiredComplianceItem[]): string | null {
  if (expired.length === 0) return null;

  const lines = expired.map((e) => `• ${e.propertyAddress} — ${e.certificateType} (expired)`).join("\n");

  return `**Portfolio health — expired certificates (authoritative; synced from compliance_records):**
${lines}

**Assistant behaviour (proactive):** When the user sends a short greeting, opens a general chat, or asks what you can do — briefly lead with the most urgent expired item in plain language. Example tone: I noticed [address] has an expired [certificate type]. I can draft an email to a qualified engineer for you. Use **get_compliance_summary** or **dispatch_maintenance_request** when they want to act. Do not repeat this same reminder on every subsequent turn unless they ask about compliance or certificates. If their message is already a specific task, answer that first, then add one sentence on compliance if it still fits.`;
}

/** Runs sync then returns alert rows for the dashboard strip. */
export async function syncAndGetPortfolioHealthAlerts(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ expired: ExpiredComplianceItem[]; alerts: PortfolioHealthAlertRow[] }> {
  const { expired } = await checkPortfolioHealth(userId, supabase);
  const alerts = await getPortfolioHealthAlertsForUser(userId, supabase);
  return { expired, alerts };
}
