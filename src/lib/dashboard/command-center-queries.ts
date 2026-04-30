import { getRecentActivity, logActivity } from "@/lib/actions/activity-log";
import { getPendingAgentApprovals, getPendingApprovalsCount } from "@/lib/actions/agent-approvals";
import { getComplianceRecordsForUser } from "@/lib/actions/compliance";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/server";
import { getOutstandingRentTotal } from "@/lib/rent-utils";

export type CommandCenterKpis = {
  pendingApprovals: number;
  overdueRentTotal: number;
  maintenanceOpen: number;
  maintenanceHighPriority: number;
  totalProperties: number;
  activeAgents: number;
};

const KPI_FALLBACK: CommandCenterKpis = {
  pendingApprovals: 0,
  overdueRentTotal: 0,
  maintenanceOpen: 0,
  maintenanceHighPriority: 0,
  totalProperties: 0,
  activeAgents: 0,
};


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

export async function loadCommandCenterKpis(userId: string): Promise<CommandCenterKpis> {
  return withTimeout(
    (async () => {
      const [
        approvalsCount,
        stats,
        overdueTotal,
        agentCount,
        maintHigh,
      ] = await Promise.all([
        getPendingApprovalsCount(userId),
        getDashboardStats(userId),
        getOutstandingRentTotal(userId),
        activeAgentCount(userId),
        highPriorityMaintenanceCount(userId),
      ]);

      return {
        pendingApprovals: approvalsCount,
        overdueRentTotal: overdueTotal,
        maintenanceOpen: stats.openMaintenance,
        maintenanceHighPriority: maintHigh,
        totalProperties: stats.totalProperties,
        activeAgents: agentCount,
      };
    })(),
    3000,
    KPI_FALLBACK,
    "command-center:loadCommandCenterKpis",
  );
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
      const data = await getRecentActivity(userId, 12);

      return (data ?? []).map((row) => {
        const d = new Date(String(row.created_at));
        const time = Number.isNaN(d.getTime())
          ? "—"
          : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
        
        let tool = String(row.tool_name ?? "EVENT").toUpperCase().replace(/_/g, " ");
        
        // Use message from args if it's a high-signal event we just added
        const args = (row as any).args || {};
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
        
        const sourceRaw = (row as any).source || "assistant";
        const source = sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1);

        return {
          id: row.id as string,
          event: tool,
          source,
          time,
        };
      });
    })(),
    3000,
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
