import { createClient } from "@supabase/supabase-js";

import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { runLLM } from "@/lib/llm/router";
import type { CEOToolName } from "./tools";

function formatTenantNameFromProfile(tenant: { full_name?: string | null } | null): string {
  return tenant?.full_name?.trim() || "Unknown tenant";
}

function normalizeTenancyRows(tenancies: unknown): { property_id?: string | null; status?: string | null }[] {
  if (Array.isArray(tenancies)) return tenancies as { property_id?: string | null; status?: string | null }[];
  if (tenancies && typeof tenancies === "object") {
    return [tenancies as { property_id?: string | null; status?: string | null }];
  }
  return [];
}

function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s) as unknown;
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) {
    const inner = tryParse(match[0]);
    if (inner) return inner;
  }
  return null;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ToolCallArgs {
  month?: string;
  status?: string;
  tenant_name?: string;
  tenant_id?: string;
  property_id?: string;
}

export async function executeCEOTool(toolName: CEOToolName, args: ToolCallArgs, userId: string): Promise<string> {
  switch (toolName) {
    case "get_dashboard_summary": {
      const [properties, tenants, maintenance, rentPayments] = await Promise.all([
        supabase.from("properties").select("id, address").eq("user_id", userId),
        supabase.from("tenant_profiles").select("id").eq("user_id", userId),
        supabase.from("maintenance_requests").select("id, title, status, priority").eq("user_id", userId),
        supabase.from("rent_payments").select("id, amount, status, due_date").eq("user_id", userId),
      ]);
      const overdueRent = rentPayments.data?.filter((r) => r.status === "overdue") ?? [];
      const openMaintenance = maintenance.data?.filter((m) => m.status !== "completed") ?? [];
      return JSON.stringify({
        total_properties: properties.data?.length ?? 0,
        total_tenants: tenants.data?.length ?? 0,
        active_tenants: tenants.data?.length ?? 0,
        overdue_rent_count: overdueRent.length,
        overdue_rent_total: overdueRent.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
        open_maintenance: openMaintenance.length,
        urgent_maintenance: maintenance.data?.filter((m) => m.priority === "urgent").length ?? 0,
      });
    }
    case "get_rent_status": {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const { data: payments } = await supabase
        .from("rent_payments")
        .select("id, amount, status, due_date, tenant_id, tenant_profiles(full_name, email)")
        .eq("user_id", userId)
        .gte("due_date", `${month}-01`)
        .lte("due_date", `${month}-31`);
      return JSON.stringify({
        month,
        payments: payments ?? [],
        paid: payments?.filter((p) => p.status === "paid").length ?? 0,
        overdue: payments?.filter((p) => p.status === "overdue").length ?? 0,
        total_expected: payments?.reduce((sum, p) => sum + Number(p.amount ?? 0), 0) ?? 0,
        total_collected:
          payments?.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount ?? 0), 0) ?? 0,
      });
    }
    case "chase_rent": {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const results = await runRentChaserAgent(userId, {
        supabase,
        month,
        source: "ceo_assistant",
      });
      if (results.length === 0) {
        return JSON.stringify({
          month,
          message: "No chaseable rent payments for this period (or none match the selected month).",
          chased: 0,
          results: [],
        });
      }
      return JSON.stringify({
        month,
        message: `Processed ${results.length} rent chase run(s). Drafts are saved to email logs; sends follow your auto-send settings.`,
        chased: results.length,
        results: results.map((r) => ({
          tenant_name: r.tenantName,
          tenant_email: r.tenantEmail,
          property_address: r.propertyAddress,
          amount_owed: r.amountOwed,
          days_overdue: r.daysOverdue,
          email_subject: r.emailSubject,
          email_sent: r.emailSent ?? false,
          agent_run_id: r.actionId,
        })),
      });
    }
    case "get_maintenance_summary": {
      const statusFilter = args.status === "all" || !args.status ? null : args.status;
      let query = supabase
        .from("maintenance_requests")
        .select("id, title, description, status, priority, created_at, property_id, properties(name)")
        .eq("user_id", userId);
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data: tickets } = await query.order("created_at", { ascending: false }).limit(20);
      if (!tickets || tickets.length === 0) {
        return JSON.stringify({ message: "No maintenance tickets found.", tickets: [] });
      }
      const summary = await runLLM({
        agentName: "maintenance",
        messages: [
          {
            role: "system",
            content:
              "You are a maintenance triage assistant. Summarise the open maintenance tickets concisely, highlighting urgent issues first.",
          },
          {
            role: "user",
            content: `Summarise these maintenance tickets: ${JSON.stringify(tickets)}`,
          },
        ],
      });
      return JSON.stringify({
        total: tickets.length,
        urgent: tickets.filter((t) => t.priority === "urgent").length,
        summary: summary.text,
        tickets,
      });
    }
    case "get_leads_summary": {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, full_name, name, email, status, qualified_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      const rows = leads ?? [];
      const byQualified = (q: string) => rows.filter((l) => (l.qualified_status ?? "").toLowerCase() === q).length;
      const byStatus = (s: string) => rows.filter((l) => (l.status ?? "").toLowerCase() === s).length;

      const recent = rows.slice(0, 8).map((l) => ({
        id: l.id,
        full_name: l.full_name ?? l.name ?? "Unknown",
        email: l.email ?? null,
        status: l.status ?? null,
        qualified_status: l.qualified_status ?? null,
        created_at: l.created_at ?? null,
      }));

      return JSON.stringify({
        total: rows.length,
        new: byStatus("new"),
        pending_qualification: byQualified("pending"),
        qualified: byQualified("qualified"),
        disqualified: byQualified("disqualified"),
        recent,
      });
    }
    case "qualify_leads": {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, full_name, email, phone, message, status, qualified_status, created_at")
        .eq("user_id", userId)
        .eq("qualified_status", "pending")
        .limit(20);
      if (!leads || leads.length === 0) {
        return JSON.stringify({ message: "No pending leads to qualify.", leads: [], persisted: [] });
      }
      const result = await runLLM({
        agentName: "leads",
        messages: [
          {
            role: "system",
            content:
              "You are a lead qualification assistant for a property rental business. Score each lead from 1-10. Return ONLY a JSON array of objects: { \"id\": string (UUID), \"score\": number, \"reason\": string, \"recommendation\": \"qualified\" | \"disqualified\" } — one object per lead id from the user message.",
          },
          {
            role: "user",
            content: `Qualify these leads (use each id exactly as given): ${JSON.stringify(leads)}`,
          },
        ],
      });
      const parsed = extractJsonArray(result.text);
      const persisted: { id: string; qualified_status: string; score?: number }[] = [];
      if (parsed) {
        for (const row of parsed) {
          if (typeof row !== "object" || row === null) continue;
          const o = row as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id : null;
          if (!id || !leads.some((l) => l.id === id)) continue;
          const score = typeof o.score === "number" && Number.isFinite(o.score) ? o.score : null;
          const rec =
            o.recommendation === "qualified" || o.recommendation === "disqualified"
              ? o.recommendation
              : score !== null && score >= 6
                ? "qualified"
                : "disqualified";
          const reason = typeof o.reason === "string" ? o.reason : "";
          const noteLine =
            score !== null
              ? `Assistant qualification (score ${score}/10): ${reason}`.trim()
              : `Assistant qualification: ${reason}`.trim();

          const { error: upErr } = await supabase
            .from("leads")
            .update({
              qualified_status: rec,
              notes: noteLine,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("user_id", userId);

          if (!upErr) {
            persisted.push({ id, qualified_status: rec, score: score ?? undefined });
          }
        }
      }
      return JSON.stringify({
        total_leads: leads.length,
        qualifications: result.text,
        persisted,
        parse_ok: Boolean(parsed && persisted.length > 0),
      });
    }
    case "draft_contract": {
      let tenantQuery = supabase
        .from("tenant_profiles")
        .select(
          "id, full_name, email, phone, tenancies(id, start_date, end_date, monthly_rent, deposit_amount, property_id, properties(name, address))",
        )
        .eq("user_id", userId);
      if (args.tenant_id) {
        tenantQuery = tenantQuery.eq("id", args.tenant_id);
      } else if (args.tenant_name) {
        tenantQuery = tenantQuery.ilike("full_name", `%${args.tenant_name.trim()}%`);
      }
      const { data: tenants } = await tenantQuery.limit(1);
      const tenant = tenants?.[0];
      if (!tenant) {
        return JSON.stringify({ error: "Tenant not found. Please check the name and try again." });
      }

      const tenanciesRaw = tenant.tenancies;
      const tenancies = Array.isArray(tenanciesRaw) ? tenanciesRaw : tenanciesRaw ? [tenanciesRaw] : [];
      const tenancy = tenancies[0] as
        | {
            start_date?: string | null;
            end_date?: string | null;
            monthly_rent?: number | string | null;
            deposit_amount?: number | string | null;
            property_id?: string | null;
          }
        | undefined;

      const propertyId = tenancy?.property_id ?? null;
      if (!propertyId) {
        return JSON.stringify({
          error: "No active tenancy with a property linked to this tenant. Open Tenancies and link a property first.",
        });
      }

      const result = await runLLM({
        agentName: "contracts",
        messages: [
          {
            role: "system",
            content:
              "You are a tenancy contract drafting assistant. Draft a professional UK Assured Shorthold Tenancy (AST) contract using the provided tenant and property details.",
          },
          {
            role: "user",
            content: `Draft a tenancy contract for: ${JSON.stringify(tenant)}`,
          },
        ],
        maxTokens: 2048,
      });

      const today = new Date();
      const defaultStart = tenancy?.start_date ?? today.toISOString().slice(0, 10);
      const defaultEnd =
        tenancy?.end_date ??
        new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
      const monthlyRent = Number(tenancy?.monthly_rent ?? 0) || 0;
      const depositAmount = Number(tenancy?.deposit_amount ?? monthlyRent) || 0;

      const { data: inserted, error: insErr } = await supabase
        .from("contracts")
        .insert({
          user_id: userId,
          tenant_id: tenant.id,
          property_id: propertyId,
          contract_type: "AST",
          start_date: defaultStart,
          end_date: defaultEnd,
          monthly_rent: monthlyRent,
          deposit_amount: depositAmount,
          special_clauses: result.text.trim() ? result.text.trim() : null,
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        return JSON.stringify({
          tenant_name: formatTenantNameFromProfile(tenant),
          contract_draft: result.text,
          saved: false,
          error: insErr?.message ?? "Could not save draft contract",
        });
      }

      return JSON.stringify({
        tenant_name: formatTenantNameFromProfile(tenant),
        contract_draft: result.text,
        saved: true,
        contract_id: inserted.id as string,
      });
    }
    case "list_tenants": {
      const { data: raw } = await supabase
        .from("tenant_profiles")
        .select("id, full_name, email, tenancies(property_id, status, properties(name))")
        .eq("user_id", userId)
        .limit(80);

      let tenants = raw ?? [];
      if (args.property_id) {
        tenants = tenants.filter((t) =>
          normalizeTenancyRows(t.tenancies).some((r) => r.property_id === args.property_id),
        );
      }
      if (args.status && args.status !== "all") {
        const want = args.status.toLowerCase();
        tenants = tenants.filter((t) =>
          normalizeTenancyRows(t.tenancies).some((r) => (r.status ?? "").toLowerCase() === want),
        );
      }
      tenants = tenants.slice(0, 50);
      return JSON.stringify({
        total: tenants.length,
        tenants,
      });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
