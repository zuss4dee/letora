import { createClient } from "@/lib/supabase/server";

import type {
  PropertyInspectorActivityAccent,
  PropertyInspectorActivityEntry,
} from "./property-inspector-activity-display";

function formatMoneyGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(amount));
}

function maintenancePropertyId(m: { tenancies?: unknown }): string | null {
  const t = m.tenancies;
  if (!t) return null;
  const row = Array.isArray(t) ? t[0] : t;
  if (!row || typeof row !== "object") return null;
  const pid = (row as { property_id?: string | null }).property_id;
  return typeof pid === "string" ? pid : null;
}

function propertyIdFromShallowRecord(r: Record<string, unknown>): string | null {
  for (const k of ["property_id", "propertyId"] as const) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function extractPropertyIdFromAgentActivity(args: unknown, result: unknown): string | null {
  for (const root of [args, result]) {
    if (!root || typeof root !== "object" || Array.isArray(root)) continue;
    const rec = root as Record<string, unknown>;
    const direct = propertyIdFromShallowRecord(rec);
    if (direct) return direct;
    const data = rec.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const nested = propertyIdFromShallowRecord(data as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function formatAgentToolTitle(toolName: string): string {
  return toolName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function agentActivityDetail(result: unknown, args: unknown): string {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    const msg = r.message ?? r.summary ?? r.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 120);
  }
  if (args && typeof args === "object" && !Array.isArray(args)) {
    const a = args as Record<string, unknown>;
    const pieces = ["property_query", "tenant_name", "tenancy_id"]
      .map((k) => a[k])
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    if (pieces.length) return pieces.join(" · ").slice(0, 120);
  }
  return "Tool call";
}

/**
 * Loads recent, property-scoped events for the registry inspector.
 * Note: `agent_activity_log` has no property_id; this uses domain tables plus
 * `agent_activity` when tool args/results include a property id.
 */
export async function loadPropertyInspectorActivityByPropertyId(
  propertyIds: string[],
): Promise<Record<string, PropertyInspectorActivityEntry[]>> {
  const empty: Record<string, PropertyInspectorActivityEntry[]> = {};
  for (const id of propertyIds) empty[id] = [];

  if (propertyIds.length === 0) return empty;

  const idSet = new Set(propertyIds);
  const supabase = await createClient();

  const [rentRes, maintRes, agentRes, tenancyRes] = await Promise.all([
    supabase
      .from("rent_payments")
      .select("id, property_id, amount, status, paid_date, due_date, created_at, notes")
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("maintenance_requests")
      .select("id, status, description, created_at, resolved_at, tenancies(property_id)")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("agent_activity")
      .select("id, tool_name, args, result, success, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tenancies")
      .select("id, property_id, status, start_date, created_at, tenants(full_name)")
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (rentRes.error) console.warn("[property-inspector-activity] rent", rentRes.error.message);
  if (maintRes.error) console.warn("[property-inspector-activity] maint", maintRes.error.message);
  if (agentRes.error) console.warn("[property-inspector-activity] agent", agentRes.error.message);
  if (tenancyRes.error) console.warn("[property-inspector-activity] tenancy", tenancyRes.error.message);

  type MutableMap = Record<string, PropertyInspectorActivityEntry[]>;
  const map: MutableMap = { ...empty };
  const push = (propertyId: string | null | undefined, entry: PropertyInspectorActivityEntry) => {
    if (!propertyId || !idSet.has(propertyId)) return;
    map[propertyId]!.push(entry);
  };

  for (const row of rentRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const property_id = r.property_id as string | null | undefined;
    const status = String(r.status ?? "pending").toLowerCase();
    const amount = r.amount as number | null | undefined;
    const created = (r.created_at as string | null | undefined) ?? new Date().toISOString();
    const accent: PropertyInspectorActivityAccent =
      status === "paid" ? "success" : status === "overdue" ? "attention" : "default";
    const title = `RENT · ${status.toUpperCase()}`;
    const detailParts: string[] = [];
    const gbp = formatMoneyGbp(amount ?? null);
    if (gbp !== "—") detailParts.push(gbp);
    const due = r.due_date as string | null | undefined;
    if (due) detailParts.push(`Due ${due}`);
    const paid = r.paid_date as string | null | undefined;
    if (paid) detailParts.push(`Paid ${paid}`);
    const notes = r.notes as string | null | undefined;
    if (notes?.trim()) detailParts.push(notes.trim().slice(0, 60));
    push(property_id, {
      id: `rent-${String(r.id)}`,
      at: created,
      title,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : "Rent payment",
      accent,
    });
  }

  for (const row of maintRes.data ?? []) {
    const m = row as {
      id: string;
      status?: string | null;
      description?: string | null;
      created_at?: string | null;
      resolved_at?: string | null;
      tenancies?: unknown;
    };
    const property_id = maintenancePropertyId(m);
    const st = String(m.status ?? "open").toLowerCase();
    const at =
      (m.resolved_at as string | null | undefined) ??
      (m.created_at as string | null | undefined) ??
      new Date().toISOString();
    const resolved = st === "resolved";
    const rawDetail = m.description?.trim() || (resolved ? "Marked resolved" : "Ticket opened");
    push(property_id, {
      id: `maint-${m.id}`,
      at,
      title: `MAINTENANCE · ${st.toUpperCase()}`,
      detail: rawDetail.slice(0, 120),
      accent: resolved ? "success" : st === "open" ? "attention" : "default",
    });
  }

  for (const row of tenancyRes.data ?? []) {
    const t = row as {
      id: string;
      property_id?: string | null;
      status?: string | null;
      start_date?: string | null;
      created_at?: string | null;
      tenants?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    };
    const property_id = t.property_id;
    const tp = t.tenants;
    const tenantRow = Array.isArray(tp) ? tp[0] : tp;
    const name = tenantRow?.full_name?.trim() ?? null;
    const at =
      (t.start_date ? `${t.start_date}T12:00:00.000Z` : null) ??
      (t.created_at as string | null | undefined) ??
      new Date().toISOString();
    const st = String(t.status ?? "active").toUpperCase();
    push(property_id, {
      id: `tenancy-${t.id}`,
      at,
      title: `TENANCY · ${st}`,
      detail: name ? name : "Tenancy record",
      accent: "default",
    });
  }

  for (const row of agentRes.data ?? []) {
    const a = row as {
      id: string;
      tool_name: string;
      args: unknown;
      result: unknown;
      success: boolean;
      created_at: string;
    };
    const property_id = extractPropertyIdFromAgentActivity(a.args, a.result);
    if (!property_id) continue;
    push(property_id, {
      id: `agent-${a.id}`,
      at: a.created_at,
      title: `AI · ${formatAgentToolTitle(a.tool_name).toUpperCase()}`,
      detail: a.success ? agentActivityDetail(a.result, a.args) : "Failed",
      accent: a.success ? "default" : "danger",
    });
  }

  for (const id of propertyIds) {
    map[id] = map[id]!
      .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
      .slice(0, 15);
  }

  return map;
}
