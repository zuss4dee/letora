import { cache } from "react";

import { getRecentActivityCommandCenterLanding } from "@/lib/actions/activity-log";
import { getPendingAgentApprovals, getPendingApprovalsCount } from "@/lib/actions/agent-approvals";
import { getDashboardStats, getMonthlyRentFromActiveTenancies } from "@/lib/actions/dashboard";
import { withTimeout } from "@/lib/async/with-timeout";
import { computeRentFinancialMonthKpis } from "@/lib/rent-financial-kpis";
import { monthBoundsIso } from "@/lib/rent-calendar-bounds";
import { createClient } from "@/lib/supabase/server";
import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-utils";

const getRecentActivityForCommandCenterLanding = cache((userId: string) =>
  getRecentActivityCommandCenterLanding(userId, 12),
);

export type CommandCenterKpis = {
  pendingApprovals: number;
  overdueRentTotal: number;
  maintenanceOpen: number;
  maintenanceHighPriority: number;
  totalProperties: number;
  activeAgents: number;
  // Financials
  /** Sum of unpaid instalments with due_date in the current calendar month. */
  rentDueThisMonth: number;
  /**
   * “Scheduled · this month”: sum of active-tenancy `monthly_rent` when roll &gt; 0 (Rent Tracker parity);
   * else sum of instalment amounts with due_date in the current UTC calendar month (any status).
   */
  rentScheduledThisMonth: number;
  /** Cash receipts this month: instalments marked paid with paid_date in the current calendar month (legacy: paid + no paid_date → due-month attribution only). */
  rentCollectedThisMonth: number;
  /** Total scheduled instalment amounts due next calendar month (all statuses — forecast / contract schedule). */
  rentExpectedNextMonth: number;
  /** Cash receipts last calendar month (`paid_date` window). */
  rentCollectedLastMonth: number;
};

/** Result of loading Command Center KPIs; `kpisDegraded` is true when timeout or error forced the zero fallback snapshot. */
export type CommandCenterKpisLoadResult = {
  kpis: CommandCenterKpis;
  kpisDegraded: boolean;
};

const KPI_FALLBACK: CommandCenterKpis = {
  pendingApprovals: 0,
  overdueRentTotal: 0,
  maintenanceOpen: 0,
  maintenanceHighPriority: 0,
  totalProperties: 0,
  activeAgents: 0,
  rentDueThisMonth: 0,
  rentScheduledThisMonth: 0,
  rentCollectedThisMonth: 0,
  rentExpectedNextMonth: 0,
  rentCollectedLastMonth: 0,
};

function degradedKpiResult(): CommandCenterKpisLoadResult {
  return { kpis: KPI_FALLBACK, kpisDegraded: true };
}

/** Set `LETORA_KPI_DIAG=1` for per-subcall timing in server logs (no user id / PII). */
const KPI_LOAD_DIAG = process.env.LETORA_KPI_DIAG === "1";

function kpiDiagLog(line: string) {
  if (!KPI_LOAD_DIAG) return;
  console.info(`[kpi-load] ${line}`);
}

async function timeKpiSubcall<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!KPI_LOAD_DIAG) return fn();
  const t0 = performance.now();
  try {
    const out = await fn();
    kpiDiagLog(`${name} ok ${Math.round(performance.now() - t0)}ms`);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    kpiDiagLog(`${name} throw ${Math.round(performance.now() - t0)}ms — ${msg}`);
    throw e;
  }
}

async function highPriorityMaintenanceCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("maintenance_requests")
    .select("id, tenancies!inner(properties!inner(user_id))", { count: "exact", head: true })
    .eq("tenancies.properties.user_id", userId)
    .in("status", ["open", "in_progress"])
    .in("priority", ["high", "urgent"]);

  if (error) {
    console.warn("[command-center] maintenance high priority count", error.message);
    return 0;
  }
  return count ?? 0;
}

async function activeAgentCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["running", "queued"]);

  if (error) {
    console.warn("[command-center] active agent count", error.message);
    return 0;
  }
  return count ?? 0;
}

type RentPaymentFinanceRow = {
  id: string;
  amount: unknown;
  status: string | null;
  due_date: string | null;
  paid_date: string | null;
};

async function loadCommandCenterFinancials(userId: string) {
  const supabase = await createClient();
  const anchor = new Date().toISOString().slice(0, 10);
  const currentMonth = monthBoundsIso(anchor, 0);

  const dueFetchStart = monthBoundsIso(anchor, -24).startIso;
  const dueFetchEnd = monthBoundsIso(anchor, 12).endIso;

  /** Pull rows by paid_date so receipts are counted even when the original due_date is stale. */
  const paidFetchStart = monthBoundsIso(anchor, -24).startIso;
  const paidFetchEnd = currentMonth.endIso;

  const sel = "id,amount,status,due_date,paid_date,tenancies!inner(properties!inner(user_id))";

  const [dueRes, paidRes, activeMonthlyRentRoll] = await Promise.all([
    supabase
      .from("rent_payments")
      .select(sel)
      .eq("tenancies.properties.user_id", userId)
      .gte("due_date", dueFetchStart)
      .lte("due_date", dueFetchEnd),
    supabase
      .from("rent_payments")
      .select(sel)
      .eq("tenancies.properties.user_id", userId)
      .not("paid_date", "is", null)
      .gte("paid_date", paidFetchStart)
      .lte("paid_date", paidFetchEnd),
    getMonthlyRentFromActiveTenancies(userId),
  ]);

  if (dueRes.error) console.warn("[command-center] rent by due_date", dueRes.error.message);
  if (paidRes.error) console.warn("[command-center] rent by paid_date", paidRes.error.message);

  const merged = new Map<string, RentPaymentFinanceRow>();
  const ingest = (rows: RentPaymentFinanceRow[] | null) => {
    for (const r of rows ?? []) merged.set(String(r.id), r);
  };
  ingest((dueRes.data ?? []) as RentPaymentFinanceRow[]);
  ingest((paidRes.data ?? []) as RentPaymentFinanceRow[]);

  const stats = computeRentFinancialMonthKpis(merged.values(), anchor, {
    activeMonthlyRentRoll: activeMonthlyRentRoll > 0 ? activeMonthlyRentRoll : undefined,
  });

  if (process.env.NODE_ENV === "development") {
    const nextMonth = monthBoundsIso(anchor, 1);
    const lastMonth = monthBoundsIso(anchor, -1);
    console.info("[command-center-financials]", {
      anchor,
      windows: { current: currentMonth, nextMonth, lastMonth },
      stats,
      activeMonthlyRentRoll,
      rowCount: merged.size,
    });
  }

  return stats;
}

async function loadCommandCenterKpisUncached(userId: string): Promise<CommandCenterKpisLoadResult> {
  return withTimeout(
    (async (): Promise<CommandCenterKpisLoadResult> => {
      const tLoad0 = KPI_LOAD_DIAG ? performance.now() : 0;
      try {
        kpiDiagLog("loadCommandCenterKpis start");
        const [
          approvalsCount,
          stats,
          agentCount,
          maintHigh,
          financials,
        ] = await Promise.all([
          timeKpiSubcall("getPendingApprovalsCount", () => getPendingApprovalsCount(userId)),
          timeKpiSubcall("getDashboardStats", () => getDashboardStats(userId)),
          timeKpiSubcall("activeAgentCount", () => activeAgentCount(userId)),
          timeKpiSubcall("highPriorityMaintenanceCount", () => highPriorityMaintenanceCount(userId)),
          timeKpiSubcall("loadCommandCenterFinancials", () => loadCommandCenterFinancials(userId)),
        ]);
        kpiDiagLog(`loadCommandCenterKpis all_subcalls ok total ${Math.round(performance.now() - tLoad0)}ms`);

        return {
          kpisDegraded: false,
          kpis: {
            pendingApprovals: approvalsCount,
            overdueRentTotal: stats.arrearsOutstanding,
            maintenanceOpen: stats.openMaintenance,
            maintenanceHighPriority: maintHigh,
            totalProperties: stats.totalProperties,
            activeAgents: agentCount,
            ...financials,
          },
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[loadCommandCenterKpis] reason=caught_exception", message);
        if (KPI_LOAD_DIAG) {
          kpiDiagLog(`loadCommandCenterKpis failed after ${Math.round(performance.now() - tLoad0)}ms`);
        }
        return degradedKpiResult();
      }
    })(),
    7500,
    degradedKpiResult(),
    "command-center:loadCommandCenterKpis",
  );
}

/**
 * Per-request dedupe: multiple RSC modules calling this in the same render pass share one Supabase burst.
 * (Cross-navigation refetches are still separate requests — see sidebar Home `prefetch` guard.)
 */
export const loadCommandCenterKpis = cache(loadCommandCenterKpisUncached);

export type ArrearsQueueRow = {
  /** Stable identity — one queue row per tenancy in arrears. */
  tenancyId: string;
  /** Tenant profile id when join resolves (for Rent Tracker `tenantId` deep-link). */
  tenantId: string | null;
  /** Oldest overdue instalment — matches typical rent-chase `target_id`; used for Rent Tracker deep-link. */
  canonicalPaymentId: string;
  tenantName: string;
  propertyAddress: string;
  /** Sum of all overdue instalments for this tenancy. */
  totalOverdueAmount: number;
  overdueInstalmentCount: number;
  /** Oldest overdue `due_date` (YYYY-MM-DD). */
  oldestDueDate: string;
  /** Whole days since `oldestDueDate`. */
  daysOverdue: number;
  actionState: "draft_ready" | "approval_needed" | "sent" | "no_draft";
  approvalId?: string;
};

export async function loadCommandCenterArrearsQueue(userId: string): Promise<ArrearsQueueRow[]> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  // Embed shape aligns with rent-tracker `getRentPayments` (stable PostgREST path).
  const { data: payments, error } = await supabase
    .from("rent_payments")
    .select(
      `
      id,
      amount,
      due_date,
      status,
      tenancies!inner (
        id,
        property_id,
        properties!inner ( address, user_id ),
        tenants ( id, full_name )
      )
    `,
    )
    .eq("tenancies.properties.user_id", userId)
    .order("due_date", { ascending: true });

  if (error) {
    console.warn("[loadCommandCenterArrearsQueue] query error:", error.message);
    return [];
  }

  const unwrap = <T,>(rel: T | T[] | null | undefined): T | null => {
    if (rel == null) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
  };

  const filtered = (payments ?? []).filter((p) =>
    isPaymentOverdue((p.status as string | null) ?? null, (p.due_date as string | null) ?? null, todayIso),
  );

  if (filtered.length === 0) return [];

  const { data: approvals } = await supabase
    .from("agent_approvals")
    .select("id, status, target_id")
    .eq("user_id", userId)
    .eq("action_type", "send_rent_chase_email")
    .eq("status", "pending");

  type GroupAcc = {
    tenancyId: string;
    tenantId: string | null;
    tenantName: string;
    propertyAddress: string;
    instalments: { paymentId: string; dueIso: string; amount: number }[];
  };

  const byTenancy = new Map<string, GroupAcc>();

  for (const p of filtered) {
    const tenancyRaw = unwrap(
      p.tenancies as
        | { id?: string; properties?: unknown; tenants?: unknown }
        | { id?: string; properties?: unknown; tenants?: unknown }[]
        | null,
    );
    const tenancyId = String(tenancyRaw?.id ?? "");
    if (!tenancyId) continue;

    const property = unwrap(tenancyRaw?.properties as { address?: string | null } | { address?: string | null }[] | null);
    const tenant = unwrap(
      tenancyRaw?.tenants as
        | { id?: string; full_name?: string | null }
        | { id?: string; full_name?: string | null }[]
        | null,
    );

    const dueIso = typeof p.due_date === "string" ? p.due_date.slice(0, 10) : "";
    const paymentId = String(p.id);
    const tenantRowId = typeof tenant?.id === "string" && tenant.id.trim().length > 0 ? tenant.id.trim() : null;

    let g = byTenancy.get(tenancyId);
    if (!g) {
      g = {
        tenancyId,
        tenantId: tenantRowId,
        tenantName: tenant?.full_name?.trim() || "Tenant",
        propertyAddress: (property?.address ?? "").split(",")[0]?.trim() || "",
        instalments: [],
      };
      byTenancy.set(tenancyId, g);
    } else if (g.tenantId == null && tenantRowId != null) {
      g.tenantId = tenantRowId;
    }
    g.instalments.push({
      paymentId,
      dueIso,
      amount: resolvePaymentAmount(p),
    });
  }

  const daysSinceDue = (dueIso: string): number => {
    const d = dueIso ? new Date(`${dueIso}T12:00:00Z`) : new Date(NaN);
    const today = new Date(`${todayIso}T12:00:00Z`);
    return Number.isNaN(d.getTime())
      ? 0
      : Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const rows: ArrearsQueueRow[] = [];

  for (const g of byTenancy.values()) {
    const sorted = [...g.instalments].sort((a, b) => a.dueIso.localeCompare(b.dueIso));
    if (sorted.length === 0) continue;

    const oldest = sorted[0]!;
    const totalAmount = sorted.reduce((s, x) => s + x.amount, 0);
    const paymentIdSet = new Set(sorted.map((x) => x.paymentId));

    const candidates = (approvals ?? []).filter((a) => paymentIdSet.has(String(a.target_id)));

    /** Prefer approval keyed to oldest overdue instalment (canonical chase / seed convention). */
    const approval =
      candidates.find((a) => String(a.target_id) === oldest.paymentId) ?? candidates[0] ?? undefined;

    rows.push({
      tenancyId: g.tenancyId,
      tenantId: g.tenantId,
      canonicalPaymentId: oldest.paymentId,
      tenantName: g.tenantName,
      propertyAddress: g.propertyAddress,
      totalOverdueAmount: totalAmount,
      overdueInstalmentCount: sorted.length,
      oldestDueDate: oldest.dueIso,
      daysOverdue: daysSinceDue(oldest.dueIso),
      actionState: approval ? "approval_needed" : "no_draft",
      approvalId: approval?.id,
    });
  }

  rows.sort(
    (a, b) =>
      a.oldestDueDate.localeCompare(b.oldestDueDate) || b.totalOverdueAmount - a.totalOverdueAmount,
  );

  return rows.slice(0, 5);
}

export type MaintenanceQueueRow = {
  id: string;
  summary: string;
  propertyContext: string;
  urgency: string;
  actionState: "draft_ready" | "approval_needed" | "sent" | "not_started";
  approvalId?: string;
};

export async function loadCommandCenterMaintenanceQueue(userId: string): Promise<MaintenanceQueueRow[]> {
  const supabase = await createClient();

  const { data: maint, error } = await supabase
    .from("maintenance_requests")
    // Maintenance requests must be scoped via their associated tenancy -> property ownership
    .select("id, description, priority, status, tenancies!inner(properties!inner(address, user_id))")
    .eq("tenancies.properties.user_id", userId)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[loadCommandCenterMaintenanceQueue] query error:", error.message);
    return [];
  }

  if (!maint || maint.length === 0) return [];

  const { data: approvals } = await supabase
    .from("agent_approvals")
    .select("id, status, target_id")
    .eq("user_id", userId)
    .eq("action_type", "approve_maintenance_dispatch")
    .eq("status", "pending");

  return maint.map((m) => {
    const t = m.tenancies as unknown as { properties?: { address?: string | null } | null };
    const approval = (approvals ?? []).find((a) => a.target_id === m.id);

    return {
      id: m.id,
      summary: m.description?.slice(0, 60) ?? "Maintenance Request",
      propertyContext: (t.properties?.address ?? "").split(",")[0],
      urgency: m.priority ?? "Normal",
      actionState: approval ? "approval_needed" : "not_started",
      approvalId: approval?.id,
    };
  });
}

export type AgentWorkStats = {
  rentChaseDrafts: number;
  maintenanceDrafts: number;
  pendingApprovals: number;
  activeAgents: number;
};

export async function loadCommandCenterAgentSummary(userId: string): Promise<AgentWorkStats> {
  const supabase = await createClient();

  const [pendingTotalRes, rentChaseRes, maintDispatchRes, agentCount] = await Promise.all([
    supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
    supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", "send_rent_chase_email"),
    supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", "approve_maintenance_dispatch"),
    activeAgentCount(userId),
  ]);

  const approvalQueryError =
    pendingTotalRes.error ?? rentChaseRes.error ?? maintDispatchRes.error;
  if (approvalQueryError) {
    console.warn("[loadCommandCenterAgentSummary]", approvalQueryError.message);
    return {
      rentChaseDrafts: 0,
      maintenanceDrafts: 0,
      pendingApprovals: 0,
      activeAgents: agentCount,
    };
  }

  return {
    rentChaseDrafts: rentChaseRes.count ?? 0,
    maintenanceDrafts: maintDispatchRes.count ?? 0,
    pendingApprovals: pendingTotalRes.count ?? 0,
    activeAgents: agentCount,
  };
}

export type AttentionRow = {
  id: string;
  title: string;
  subline: string;
  href: string;
  tone: "danger" | "neutral" | "warning";
};

export async function loadCommandCenterAttention(userId: string): Promise<AttentionRow[]> {
  return withTimeout(
    (async () => {
      const approvals = await getPendingAgentApprovals(5);
      const rows: AttentionRow[] = approvals.map((a) => ({
        id: a.id,
        title: a.title?.trim() ? a.title : "Pending approval",
        subline: (a.summary ?? "").slice(0, 120) || a.action_type || "—",
        href: "/dashboard/approvals",
        tone: "danger" as const,
      }));

      if (rows.length >= 3) return rows.slice(0, 3);

      const supabase = await createClient();
      const { data: maint } = await supabase
        .from("maintenance_requests")
        .select("id,description,status,tenancies!inner(properties!inner(address,user_id))")
        .eq("tenancies.properties.user_id", userId)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(3);

      const extra = (maint ?? []).map((m) => {
        const t = m as {
          id?: string;
          description?: string | null;
          tenancies?: { properties?: { address?: string | null } | null } | null;
        };
        const addr = t.tenancies?.properties?.address ?? "Property";
        return {
          id: `m-${String(m.id)}`,
          title: (t.description ?? "Maintenance request").slice(0, 80),
          subline: `PROPERTY: ${String(addr).toUpperCase().slice(0, 60)}`,
          href: "/dashboard/maintenance",
          tone: "warning" as const,
        };
      });

      const merged = [...rows, ...extra];
      return merged.slice(0, 3);
    })(),
    3000,
    [],
    "command-center:loadCommandCenterAttention",
  );
}

export type ActivityRow = { id: string; event: string; source: string; time: string };

export async function loadCommandCenterActivity(userId: string): Promise<ActivityRow[]> {
  return withTimeout(
    (async () => {
      const data = await getRecentActivityForCommandCenterLanding(userId);

      return (data ?? []).map((row) => {
        const d = new Date(String(row.created_at));
        const time = Number.isNaN(d.getTime())
          ? "—"
          : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

        let tool = String(row.tool_name ?? "EVENT").toUpperCase().replace(/_/g, " ");

        // Use message from args if it's a high-signal event we just added
        const args = (row as { args?: { message?: string } }).args || {};
        if (args.message && tool.startsWith("PORTFOLIO IMPORT")) {
          tool = args.message;
        } else {
          if (tool === "CHASE RENT") tool = "RENT CHASE";
          if (tool === "GET MAINTENANCE SUMMARY") tool = "MAINTENANCE";
          if (tool === "GET PENDING APPROVALS SUMMARY") tool = "APPROVALS CHECK";
          if (tool === "SEARCH PROPERTIES") tool = "PROPERTY SEARCH";
          if (tool === "LIST TENANTS") tool = "TENANT LIST";
          if (tool === "GET RENT STATUS") tool = "RENT TRACKER";
          if (tool.startsWith("APPROVED & EXECUTED")) tool = "APPROVED: " + tool.replace("APPROVED & EXECUTED: ", "");
          if (tool === "DENIED: ACTION") tool = "DECISION: DENIED";
          if (tool.startsWith("PROPOSED:")) tool = "REQUEST: " + tool.replace("PROPOSED: ", "");
        }

        const sourceRaw = (row as { source?: string }).source || "assistant";
        const source = sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1);

        return {
          id: row.id as string,
          event: tool,
          source,
          time,
        };
      });
    })(),
    6000,
    [],
    "command-center:loadCommandCenterActivity",
  );
}

export type OnboardingBar = { id: string; label: string; pct: number };

function onboardingPct(status: string | null): number {
  const s = (status ?? "").toLowerCase();
  if (s === "complete") return 100;
  if (s === "contract_sent") return 85;
  if (s === "references") return 55;
  if (s === "in_progress") return 45;
  if (s === "not_started") return 15;
  return 35;
}

export async function loadCommandCenterOnboardingBars(userId: string): Promise<OnboardingBar[]> {
  return withTimeout(
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("tenancies")
        .select("id,onboarding_status,tenants(full_name),properties!inner(user_id,address)")
        .eq("properties.user_id", userId)
        .neq("onboarding_status", "complete")
        .order("created_at", { ascending: false })
        .limit(4);

      if (error || !data?.length) {
        if (error) console.warn("[command-center] onboarding bars", error.message);
        return [
          { id: "a", label: "No active onboarding", pct: 0 },
          { id: "b", label: "—", pct: 0 },
        ];
      }

      return data.map((row) => {
        const r = row as {
          id: string;
          onboarding_status?: string | null;
          tenants?: { full_name?: string | null } | null;
          properties?: { address?: string | null } | null;
        };
        const name = r.tenants?.full_name?.trim() || "Tenant";
        const addr = (r.properties?.address ?? "").split(",")[0]?.trim() || "Property";
        return {
          id: r.id,
          label: `${name} (${addr})`,
          pct: onboardingPct(r.onboarding_status ?? null),
        };
      });
    })(),
    3000,
    [
      { id: "fallback-a", label: "—", pct: 0 },
      { id: "fallback-b", label: "—", pct: 0 },
    ],
    "command-center:loadCommandCenterOnboardingBars",
  );
}
