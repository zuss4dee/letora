import { createClient } from "@/lib/supabase/server";

import type { TenancyRow } from "@/lib/actions/tenancies";

import type {
  TenancyInspectorActivityEntry,
  TenancyOnboardingTasksByTenancyId,
  TenancyOnboardingTaskDto,
} from "./tenancy-inspector-types";

function formatMoneyGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(amount));
}

function propertyIdFromShallowRecord(r: Record<string, unknown>): string | null {
  for (const k of ["property_id", "propertyId"] as const) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function tenancyIdFromShallowRecord(r: Record<string, unknown>): string | null {
  for (const k of ["tenancy_id", "tenancyId"] as const) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) return v;
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
    const pieces = ["property_query", "tenant_name", "tenancy_id", "tenancyId"]
      .map((k) => a[k])
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    if (pieces.length) return pieces.join(" · ").slice(0, 120);
  }
  return "Tool call";
}

function collectTenancyIdsFromAgentRoots(
  roots: unknown[],
  tenancyIdSet: Set<string>,
  propertyToTenancies: Map<string, string[]>,
): string[] {
  const out = new Set<string>();
  for (const root of roots) {
    if (!root || typeof root !== "object" || Array.isArray(root)) continue;
    const rec = root as Record<string, unknown>;
    const tid = tenancyIdFromShallowRecord(rec);
    if (tid && tenancyIdSet.has(tid)) out.add(tid);
    const directPid = propertyIdFromShallowRecord(rec);
    if (directPid) {
      for (const t of propertyToTenancies.get(directPid) ?? []) out.add(t);
    }
    const data = rec.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const nested = data as Record<string, unknown>;
      const tid2 = tenancyIdFromShallowRecord(nested);
      if (tid2 && tenancyIdSet.has(tid2)) out.add(tid2);
      const nestedPid = propertyIdFromShallowRecord(nested);
      if (nestedPid) {
        for (const t of propertyToTenancies.get(nestedPid) ?? []) out.add(t);
      }
    }
  }
  return [...out];
}

function resolveTenancyIdsFromAgentActivity(
  args: unknown,
  result: unknown,
  tenancyIdSet: Set<string>,
  propertyToTenancies: Map<string, string[]>,
): string[] {
  return collectTenancyIdsFromAgentRoots([args, result], tenancyIdSet, propertyToTenancies);
}

function dateToIsoMidday(dateStr: string | null | undefined): string | null {
  if (!dateStr?.trim()) return null;
  return `${dateStr.trim()}T12:00:00.000Z`;
}

/**
 * Recent tenancy-scoped events: rent payments, maintenance, referencing, contracts, tenancies row,
 * and `agent_activity` when tool payloads reference the tenancy or property.
 */
export async function loadTenancyInspectorActivityByTenancyId(
  tenancies: Pick<TenancyRow, "id" | "propertyId">[],
): Promise<Record<string, TenancyInspectorActivityEntry[]>> {
  const empty: Record<string, TenancyInspectorActivityEntry[]> = {};
  const tenancyIds = tenancies.map((t) => t.id);
  for (const id of tenancyIds) empty[id] = [];
  if (tenancyIds.length === 0) return empty;

  const tenancyIdSet = new Set(tenancyIds);
  const propertyToTenancies = new Map<string, string[]>();
  for (const t of tenancies) {
    const pid = t.propertyId;
    if (!pid) continue;
    const list = propertyToTenancies.get(pid) ?? [];
    list.push(t.id);
    propertyToTenancies.set(pid, list);
  }

  const supabase = await createClient();

  const [rentRes, maintRes, refRes, contractRes, agentRes] = await Promise.all([
    supabase
      .from("rent_payments")
      .select("id, tenancy_id, amount_due, amount_paid, paid_on, due_date, status, notes, created_at")
      .in("tenancy_id", tenancyIds)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("maintenance_requests")
      .select("id, tenancy_id, status, description, created_at, resolved_at")
      .in("tenancy_id", tenancyIds)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("referencing_events")
      .select("id, tenancy_id, direction, subject, body_preview, outcome, created_at")
      .in("tenancy_id", tenancyIds)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("contracts")
      .select("id, tenancy_id, status, created_at, updated_at")
      .in("tenancy_id", tenancyIds)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("agent_activity")
      .select("id, tool_name, args, result, success, created_at")
      .order("created_at", { ascending: false })
      .limit(160),
  ]);

  if (rentRes.error) console.warn("[tenancy-inspector-data] rent", rentRes.error.message);
  if (maintRes.error) console.warn("[tenancy-inspector-data] maint", maintRes.error.message);
  if (refRes.error) console.warn("[tenancy-inspector-data] referencing", refRes.error.message);
  if (contractRes.error) console.warn("[tenancy-inspector-data] contracts", contractRes.error.message);
  if (agentRes.error) console.warn("[tenancy-inspector-data] agent", agentRes.error.message);

  type MutableMap = Record<string, TenancyInspectorActivityEntry[]>;
  const map: MutableMap = { ...empty };

  const pushAll = (tenancyIdsForEvent: string[], entry: TenancyInspectorActivityEntry) => {
    for (const tid of tenancyIdsForEvent) {
      if (!tenancyIdSet.has(tid)) continue;
      map[tid]!.push(entry);
    }
  };

  const pushOne = (tenancyId: string | null | undefined, entry: TenancyInspectorActivityEntry) => {
    if (!tenancyId || !tenancyIdSet.has(tenancyId)) return;
    map[tenancyId]!.push(entry);
  };

  for (const row of rentRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const tenancy_id = r.tenancy_id as string | null | undefined;
    const status = String(r.status ?? "pending").toLowerCase();
    const amountDue = r.amount_due as number | null | undefined;
    const amountPaid = r.amount_paid as number | null | undefined;
    const created = (r.created_at as string | null | undefined) ?? new Date().toISOString();
    const accent: TenancyInspectorActivityEntry["accent"] =
      status === "paid" ? "success" : status === "overdue" ? "attention" : "default";
    const title = `RENT · ${status.toUpperCase()}`;
    const detailParts: string[] = [];
    const due = r.due_date as string | null | undefined;
    if (due) detailParts.push(`Due ${due}`);
    const paidOn = r.paid_on as string | null | undefined;
    if (paidOn) detailParts.push(`Paid on ${paidOn}`);
    const ad = formatMoneyGbp(amountDue ?? null);
    const ap = formatMoneyGbp(amountPaid ?? null);
    if (ad !== "—") detailParts.push(ad);
    if (ap !== "—" && status === "paid") detailParts.push(`Received ${ap}`);
    const notes = r.notes as string | null | undefined;
    if (notes?.trim()) detailParts.push(notes.trim().slice(0, 80));
    const at =
      dateToIsoMidday(paidOn) ??
      dateToIsoMidday(due) ??
      created;
    pushOne(tenancy_id, {
      id: `rent-${String(r.id)}`,
      at,
      title,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : "Rent payment",
      accent,
    });
  }

  for (const row of maintRes.data ?? []) {
    const m = row as {
      id: string;
      tenancy_id?: string | null;
      status?: string | null;
      description?: string | null;
      created_at?: string | null;
      resolved_at?: string | null;
    };
    const st = String(m.status ?? "open").toLowerCase();
    const at =
      (m.resolved_at as string | null | undefined) ??
      (m.created_at as string | null | undefined) ??
      new Date().toISOString();
    const resolved = st === "resolved";
    const rawDetail = m.description?.trim() || (resolved ? "Marked resolved" : "Ticket opened");
    pushOne(m.tenancy_id, {
      id: `maint-${m.id}`,
      at,
      title: `MAINTENANCE · ${st.toUpperCase()}`,
      detail: rawDetail.slice(0, 120),
      accent: resolved ? "success" : st === "open" ? "attention" : "default",
    });
  }

  for (const row of refRes.data ?? []) {
    const e = row as {
      id: string;
      tenancy_id: string;
      direction: string;
      subject?: string | null;
      body_preview?: string | null;
      outcome?: string | null;
      created_at: string;
    };
    const dir = String(e.direction ?? "").toUpperCase();
    const detail =
      e.subject?.trim() ||
      e.body_preview?.trim()?.slice(0, 120) ||
      e.outcome?.trim() ||
      "Referencing event";
    pushOne(e.tenancy_id, {
      id: `ref-${e.id}`,
      at: e.created_at,
      title: `REFERENCING · ${dir}`,
      detail: detail.slice(0, 120),
      accent: "default",
    });
  }

  for (const row of contractRes.data ?? []) {
    const c = row as {
      id: string;
      tenancy_id: string | null;
      status?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    };
    const st = String(c.status ?? "draft").toUpperCase();
    const at = (c.updated_at as string | null | undefined) ?? (c.created_at as string | null | undefined) ?? new Date().toISOString();
    pushOne(c.tenancy_id, {
      id: `contract-${c.id}`,
      at,
      title: `CONTRACT · ${st}`,
      detail: "Tenancy agreement",
      accent: st === "SIGNED" || st === "ACTIVE" ? "success" : "default",
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
    const targets = resolveTenancyIdsFromAgentActivity(a.args, a.result, tenancyIdSet, propertyToTenancies);
    if (targets.length === 0) continue;
    pushAll(targets, {
      id: `agent-${a.id}`,
      at: a.created_at,
      title: `AI · ${formatAgentToolTitle(a.tool_name).toUpperCase()}`,
      detail: a.success ? agentActivityDetail(a.result, a.args) : "Failed",
      accent: a.success ? "default" : "danger",
    });
  }

  for (const id of tenancyIds) {
    map[id] = map[id]!
      .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
      .slice(0, 18);
  }

  return map;
}

export async function loadTenancyOnboardingTasksByTenancyId(
  tenancyIds: string[],
): Promise<TenancyOnboardingTasksByTenancyId> {
  const empty: TenancyOnboardingTasksByTenancyId = {};
  for (const id of tenancyIds) empty[id] = [];
  if (tenancyIds.length === 0) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select("id, tenancy_id, task_name, task_type, status, completed_at, created_at")
    .in("tenancy_id", tenancyIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[tenancy-inspector-data] onboarding_tasks", error.message);
    return empty;
  }

  for (const row of data ?? []) {
    const r = row as {
      id: string;
      tenancy_id: string;
      task_name: string;
      task_type: string;
      status: string;
      completed_at: string | null;
    };
    const st = String(r.status ?? "pending").toLowerCase();
    const status: TenancyOnboardingTaskDto["status"] =
      st === "complete" || st === "skipped" || st === "pending" ? (st as TenancyOnboardingTaskDto["status"]) : "pending";
    const task: TenancyOnboardingTaskDto = {
      id: r.id,
      taskName: r.task_name,
      taskType: r.task_type,
      status,
      completedAt: r.completed_at ?? null,
    };
    if (!empty[r.tenancy_id]) empty[r.tenancy_id] = [];
    empty[r.tenancy_id]!.push(task);
  }

  return empty;
}
