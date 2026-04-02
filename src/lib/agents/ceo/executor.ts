import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runLeadQualifierAgent } from "@/lib/agents/lead-qualifier";
import { runMaintenanceAgent } from "@/lib/agents/maintenance-agent";
import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { runLLM } from "@/lib/llm/router";
import { sendEmailTool } from "@/lib/tools/send-email";
import { labelPropertyRow, rankPropertySearch, type PropertySearchRow } from "@/lib/agents/ceo/search-properties";
import { looksLikeUuid, resolveTenantProfileForAccount } from "@/lib/agents/ceo/resolve-tenant-profile";
import type { CEOToolName } from "./tools";
import { normalizeCEOToolInput } from "./safety";

function formatTenantNameFromProfile(tenant: { full_name?: string | null } | null): string {
  return tenant?.full_name?.trim() || "Unknown tenant";
}

function normalizeTenancyRows(tenancies: unknown): {
  id?: string | null;
  property_id?: string | null;
  status?: string | null;
}[] {
  if (Array.isArray(tenancies)) {
    return tenancies as { id?: string | null; property_id?: string | null; status?: string | null }[];
  }
  if (tenancies && typeof tenancies === "object") {
    return [tenancies as { id?: string | null; property_id?: string | null; status?: string | null }];
  }
  return [];
}

function unwrapTenancyProperty(row: { properties?: unknown }): { address?: string | null; city?: string | null } | null {
  const p = row.properties as unknown;
  const o = Array.isArray(p) ? p[0] : p;
  return o && typeof o === "object" ? (o as { address?: string | null; city?: string | null }) : null;
}

function tenancyMatchesOnboardingHint(row: { properties?: unknown }, hint: string): boolean {
  const p = unwrapTenancyProperty(row);
  if (!p) return false;
  const h = hint.toLowerCase().trim();
  if (!h) return false;
  const addr = (p.address ?? "").toLowerCase();
  const city = (p.city ?? "").toLowerCase();
  const words = h.split(/\s+/).filter((w) => w.length > 1);
  return addr.includes(h) || city.includes(h) || words.some((w) => addr.includes(w) || city.includes(w));
}

type TenancyRowForOnboarding = {
  id: string;
  status?: string | null;
  properties?: unknown;
};

function mapTenancyCandidate(r: TenancyRowForOnboarding) {
  const p = unwrapTenancyProperty(r);
  return {
    tenancy_id: r.id,
    status: r.status ?? null,
    address: p?.address ?? null,
    city: p?.city ?? null,
  };
}

/**
 * Pick a single tenancy for onboarding: optional address/city hint, then prefer active when ambiguous.
 */
function pickTenancyForOnboarding(
  rows: TenancyRowForOnboarding[],
  propertyHint?: string,
):
  | { ok: true; tenancy_id: string }
  | { ok: false; error: string; candidates: ReturnType<typeof mapTenancyCandidate>[] } {
  let work = rows;
  const hint = propertyHint?.trim();
  if (hint) {
    const narrowed = rows.filter((r) => tenancyMatchesOnboardingHint(r, hint));
    if (narrowed.length === 1) {
      return { ok: true, tenancy_id: narrowed[0].id };
    }
    if (narrowed.length === 0) {
      return {
        ok: false,
        error:
          "No tenancy matched onboarding_property_hint — try a street or city from the candidates, or pass tenancy_id from list_tenants.",
        candidates: rows.map(mapTenancyCandidate),
      };
    }
    work = narrowed;
  }
  const active = work.filter((r) => (r.status ?? "").toLowerCase() === "active");
  const pool = active.length ? active : work;
  if (pool.length === 1) {
    return { ok: true, tenancy_id: pool[0].id };
  }
  return {
    ok: false,
    error:
      pool.length === 0
        ? "No tenancy found for this tenant."
        : "Multiple tenancies match — add onboarding_property_hint (street or city) or pick tenancy_id from list_tenants.",
    candidates: pool.map(mapTenancyCandidate),
  };
}

const defaultSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ToolCallArgs {
  month?: string;
  status?: string;
  tenant_name?: string;
  tenant_id?: string;
  property_id?: string;
  lead_id?: string;
  tenancy_id?: string;
  /** Resolve tenant by name then tenancy — use with start_tenant_onboarding (no UUIDs required). */
  onboarding_for?: string;
  onboarding_property_hint?: string;
  auto_create_tenant_and_tenancy?: boolean;
  start_date?: string;
  /** search_properties */
  query?: string;
  limit?: string | number;
  issue_title?: string;
  issue_description?: string;
  contractor_name?: string;
  contractor_email?: string;
  dispatch_channel?: "email" | "sms" | "both";
  tone?: "premium" | "family" | "student" | "investor";
  target_channel?: "rightmove" | "zoopla" | "generic";
  save_to_property?: boolean;
  /** From tool input (strings). */
  step?: string;
  decision?: string;
}

function normalizePipelineStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function addOneYearIsoDate(startDateIso: string): string {
  const d = new Date(`${startDateIso.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setUTCFullYear(fallback.getUTCFullYear() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function displayLeadName(lead: { full_name?: string | null; name?: string | null }): string {
  const n = (lead.full_name ?? lead.name ?? "").trim();
  return n || "Unknown lead";
}

function appendLeadNote(prev: string | null | undefined, line: string): string {
  const p = (prev ?? "").trim();
  const day = new Date().toISOString().slice(0, 10);
  const block = `[${day}] ${line}`;
  return p ? `${p}\n\n${block}` : block;
}

function classifyMaintenanceCategory(desc: string): {
  category: "plumbing" | "electrical" | "heating" | "structural" | "general";
  priority: "urgent" | "standard";
} {
  const t = desc.toLowerCase();
  const urgent =
    /\b(gas|smoke|fire|flood|burst|no\s+heat|no\s+heating|electrical\s+burn|sparks?|shock|ceiling\s+collapse)\b/.test(
      t,
    ) || /\burgent|emergency|immediately|asap\b/.test(t);
  if (/\b(pipe|leak|toilet|drain|plumb)\b/.test(t)) {
    return { category: "plumbing", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(electric|socket|power|lighting|fuse|breaker|wire)\b/.test(t)) {
    return { category: "electrical", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(boiler|radiator|heating|thermostat|hot\s+water)\b/.test(t)) {
    return { category: "heating", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(roof|wall|window|door|crack|damp|mould|mold)\b/.test(t)) {
    return { category: "structural", priority: urgent ? "urgent" : "standard" };
  }
  return { category: "general", priority: urgent ? "urgent" : "standard" };
}

function parseBoolArg(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

export async function executeCEOTool(
  toolName: CEOToolName,
  rawArgs: ToolCallArgs,
  userId: string,
  supabase: SupabaseClient = defaultSupabase,
): Promise<string> {
  const args = normalizeCEOToolInput(rawArgs as unknown as Record<string, unknown>) as unknown as ToolCallArgs;

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
    case "search_properties": {
      const query = (args.query ?? "").trim();
      const rawLim = args.limit;
      const parsedLim =
        typeof rawLim === "number"
          ? rawLim
          : rawLim != null && String(rawLim).length > 0
            ? parseInt(String(rawLim), 10)
            : 15;
      const limit = Math.min(30, Math.max(1, Number.isFinite(parsedLim) ? parsedLim : 15));

      const { data: rows, error } = await supabase
        .from("properties")
        .select("id, address, city, postcode, monthly_rent")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        return JSON.stringify({ error: error.message, candidates: [] });
      }

      const { candidates, hint } = rankPropertySearch(query, (rows ?? []) as PropertySearchRow[], limit);
      return JSON.stringify({
        query,
        candidates: candidates.map((r) => ({
          id: r.id,
          label: labelPropertyRow(r),
          address: r.address,
          city: r.city,
          postcode: r.postcode,
          monthly_rent: r.monthly_rent,
        })),
        hint,
        disambiguation:
          candidates.length > 1
            ? "Multiple properties matched — use city and monthly_rent to choose the correct **id** (full UUID), not a unit number alone."
            : null,
      });
    }
    case "start_tenant_onboarding": {
      const tenancyId = args.tenancy_id?.trim();
      if (tenancyId) {
        const result = await runTenantOnboardingAgent(tenancyId, userId, supabase);
        return JSON.stringify({
          mode: "existing_tenancy",
          tenancy_id: tenancyId,
          ...result,
        });
      }

      let onboardingFor = args.onboarding_for?.trim() ?? "";
      if (
        !onboardingFor &&
        args.tenant_id?.trim() &&
        !looksLikeUuid(args.tenant_id.trim()) &&
        !args.property_id?.trim() &&
        !args.lead_id?.trim()
      ) {
        onboardingFor = args.tenant_id.trim();
      }
      if (onboardingFor) {
        const resolved = await resolveTenantProfileForAccount(supabase, userId, onboardingFor);
        if (!resolved.ok) {
          return JSON.stringify(resolved.body);
        }
        const { data: tenRows, error: tenErr } = await supabase
          .from("tenancies")
          .select(
            `
            id,
            status,
            property_id,
            properties!inner ( address, city, user_id )
          `,
          )
          .eq("tenant_id", resolved.tenantId)
          .eq("properties.user_id", userId);

        if (tenErr) {
          return JSON.stringify({ error: `Could not load tenancies: ${tenErr.message}` });
        }
        const rows = (tenRows ?? []) as TenancyRowForOnboarding[];
        if (rows.length === 0) {
          return JSON.stringify({
            error:
              "No tenancy found for this tenant on your account. Create a tenancy first (tenant + property + start date) or use the dashboard.",
            tenant_id: resolved.tenantId,
            full_name: resolved.full_name,
          });
        }

        const picked = pickTenancyForOnboarding(rows, args.onboarding_property_hint);
        if (!picked.ok) {
          return JSON.stringify({
            error: picked.error,
            tenant_id: resolved.tenantId,
            full_name: resolved.full_name,
            tenant_resolved_via: resolved.resolved_via,
            candidates: picked.candidates,
          });
        }

        const result = await runTenantOnboardingAgent(picked.tenancy_id, userId, supabase);
        return JSON.stringify({
          mode: "onboarding_for_name",
          onboarded_for: resolved.full_name,
          tenant_id: resolved.tenantId,
          tenant_resolved_via: resolved.resolved_via,
          tenancy_id: picked.tenancy_id,
          ...result,
        });
      }

      const tenantIdNew = args.tenant_id?.trim();
      const propertyIdNew = args.property_id?.trim();
      const startDateNew = args.start_date?.trim();
      const leadIdArg = args.lead_id?.trim();

      if (tenantIdNew && propertyIdNew && startDateNew && !leadIdArg) {
        const resolvedTenant = await resolveTenantProfileForAccount(supabase, userId, tenantIdNew);
        if (!resolvedTenant.ok) {
          return JSON.stringify(resolvedTenant.body);
        }
        const tenantIdResolved = resolvedTenant.tenantId;

        const { data: propertyRow, error: propErr } = await supabase
          .from("properties")
          .select("id, user_id, monthly_rent")
          .eq("id", propertyIdNew)
          .eq("user_id", userId)
          .maybeSingle();
        if (propErr) {
          return JSON.stringify({ error: `Could not load property: ${propErr.message}` });
        }
        if (!propertyRow) {
          return JSON.stringify({
            error:
              "Property not found for this account. Call search_properties with the address or postcode to get the correct property UUID.",
          });
        }

        const { data: dup } = await supabase
          .from("tenancies")
          .select("id")
          .eq("tenant_id", tenantIdResolved)
          .eq("property_id", propertyIdNew)
          .eq("status", "active")
          .maybeSingle();
        if (dup) {
          return JSON.stringify({
            error:
              "An active tenancy already exists for this tenant and property. Use tenancy_id with start_tenant_onboarding, or open /dashboard/tenancies.",
            tenancy_id: dup.id,
          });
        }

        const monthlyRent =
          propertyRow.monthly_rent == null ? null : Number(propertyRow.monthly_rent) || null;
        const endDate = addOneYearIsoDate(startDateNew);
        const newTenancyId = crypto.randomUUID();
        const { error: tenancyErr } = await supabase.from("tenancies").insert({
          id: newTenancyId,
          property_id: propertyIdNew,
          tenant_id: tenantIdResolved,
          start_date: startDateNew,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_amount: monthlyRent,
          status: "active",
        });
        if (tenancyErr) {
          return JSON.stringify({ error: `Could not create tenancy: ${tenancyErr.message}` });
        }

        const result = await runTenantOnboardingAgent(newTenancyId, userId, supabase);
        return JSON.stringify({
          mode: "tenant_and_property",
          tenant_id: tenantIdResolved,
          tenant_resolved_via: resolvedTenant.resolved_via,
          property_id: propertyIdNew,
          tenancy_id: newTenancyId,
          ...result,
        });
      }

      const leadId = args.lead_id?.trim();
      const createFromLead = parseBoolArg(args.auto_create_tenant_and_tenancy);
      if (!leadId || !createFromLead) {
        return JSON.stringify({
          error:
            "Provide `onboarding_for` (tenant name — no UUIDs), or `tenancy_id`, or `tenant_id` + `property_id` + `start_date`, or `lead_id` with `auto_create_tenant_and_tenancy=true`. Optional `onboarding_property_hint` disambiguates multiple tenancies. Use search_properties for property UUIDs when creating a new tenancy.",
        });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, user_id, property_id, full_name, name, email, phone, move_in_date, qualified_status, status")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const propertyId = (args.property_id?.trim() || lead.property_id || "") as string;
      if (!propertyId) {
        return JSON.stringify({
          error: "Property is required to create tenancy from lead. Provide property_id or ensure lead has property_id.",
        });
      }

      const { data: property } = await supabase
        .from("properties")
        .select("id, user_id, monthly_rent")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!property) {
        return JSON.stringify({ error: "Property not found for this account." });
      }

      const tenantId = crypto.randomUUID();
      const tenantName = (lead.full_name ?? lead.name ?? "").trim();
      const { error: tenantErr } = await supabase.from("tenant_profiles").insert({
        id: tenantId,
        user_id: userId,
        full_name: tenantName || "New tenant",
        email: lead.email ?? null,
        phone: lead.phone ?? null,
      });
      if (tenantErr) {
        return JSON.stringify({ error: `Could not create tenant profile: ${tenantErr.message}` });
      }

      const newTenancyId = crypto.randomUUID();
      const startDate = (args.start_date ?? lead.move_in_date ?? new Date().toISOString().slice(0, 10)) as string;
      const monthlyRent =
        property.monthly_rent == null ? null : Number(property.monthly_rent) || null;
      const { error: tenancyErr } = await supabase.from("tenancies").insert({
        id: newTenancyId,
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: startDate,
        monthly_rent: monthlyRent,
        deposit_amount: monthlyRent,
        status: "active",
      });
      if (tenancyErr) {
        return JSON.stringify({ error: `Could not create tenancy: ${tenancyErr.message}` });
      }

      await supabase
        .from("leads")
        .update({
          qualified_status: "qualified",
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      const result = await runTenantOnboardingAgent(newTenancyId, userId, supabase);
      return JSON.stringify({
        mode: "lead_conversion",
        lead_id: leadId,
        tenant_id: tenantId,
        tenancy_id: newTenancyId,
        ...result,
      });
    }
    case "dispatch_maintenance_request": {
      const tenancyId = args.tenancy_id?.trim();
      const issue = (args.issue_description ?? "").trim();
      if (!tenancyId || !issue) {
        return JSON.stringify({
          error: "tenancy_id and issue_description are required.",
        });
      }

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select(
          "id, property_id, properties!inner(user_id, address), tenant_profiles!inner(id, full_name, email)",
        )
        .eq("id", tenancyId)
        .eq("properties.user_id", userId)
        .maybeSingle();
      if (!tenancy) {
        return JSON.stringify({ error: "Tenancy not found for this account." });
      }

      const classified = classifyMaintenanceCategory(
        `${args.issue_title ?? ""} ${args.issue_description ?? ""}`,
      );
      const requestId = crypto.randomUUID();
      const fullDescription = [args.issue_title?.trim(), args.issue_description?.trim()]
        .filter(Boolean)
        .join("\n\n");
      const { error: insertErr } = await supabase.from("maintenance_requests").insert({
        id: requestId,
        tenancy_id: tenancyId,
        description: fullDescription,
        category: classified.category,
        priority: classified.priority,
        status: "open",
        reported_by_tenant: false,
      });
      if (insertErr) {
        return JSON.stringify({ error: `Failed to create maintenance request: ${insertErr.message}` });
      }

      const triage = await runMaintenanceAgent(requestId, userId, supabase);
      const contractorEmail = args.contractor_email?.trim();
      const contractorName = args.contractor_name?.trim() || "Contractor";
      const requestedChannel = args.dispatch_channel ?? "email";
      let contractorDispatch:
        | { sent: boolean; emailLogId: string; message: string; error?: string }
        | null = null;

      if (requestedChannel !== "sms" && contractorEmail) {
        contractorDispatch = await sendEmailTool(supabase, userId, triage.agentRunId, {
          to: contractorEmail,
          toName: contractorName,
          agentType: "maintenance",
          subject: `Maintenance dispatch: ${args.issue_title?.trim() || "New issue"}`,
          body: [
            `A maintenance request has been raised.`,
            `Category: ${classified.category}`,
            `Priority: ${classified.priority}`,
            "",
            `Issue details:`,
            fullDescription,
          ].join("\n"),
        });

        await supabase
          .from("maintenance_requests")
          .update({
            contractor_name: contractorName,
            contractor_email: contractorEmail,
            status: "in_progress",
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return JSON.stringify({
        maintenance_request_id: requestId,
        category: classified.category,
        priority: classified.priority,
        triage,
        contractor_dispatch: contractorDispatch,
        channel_note:
          requestedChannel === "sms"
            ? "SMS dispatch requested but SMS transport is not yet implemented in-app; no SMS sent."
            : requestedChannel === "both"
              ? "Email dispatch attempted; SMS not yet implemented."
              : "Email dispatch handled based on provided contractor details and settings.",
      });
    }
    case "generate_property_listing": {
      const propertyId = args.property_id?.trim();
      if (!propertyId) {
        return JSON.stringify({ error: "property_id is required." });
      }
      const { data: property } = await supabase
        .from("properties")
        .select("id, user_id, address, city, postcode, property_type, bedrooms, bathrooms, monthly_rent, status")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!property) {
        return JSON.stringify({ error: "Property not found for this account." });
      }

      const tone = args.tone ?? "premium";
      const channel = args.target_channel ?? "generic";
      const save = args.save_to_property !== false;
      const listingResp = await runLLM({
        agentName: "ceo",
        messages: [
          {
            role: "system",
            content:
              "You are a UK property marketing copywriter. Write concise, factual, compliant listing copy. Do not invent features.",
          },
          {
            role: "user",
            content: `Generate ${channel} listing copy in a ${tone} tone for this property JSON: ${JSON.stringify(
              property,
            )}. Return plain text only.`,
          },
        ],
        maxTokens: 700,
      });
      const listing = listingResp.text.trim();
      if (!save) {
        return JSON.stringify({
          property_id: propertyId,
          saved: false,
          listing_description: listing,
        });
      }

      const { error: saveErr } = await supabase
        .from("properties")
        .update({ marketing_description: listing })
        .eq("id", propertyId)
        .eq("user_id", userId);

      return JSON.stringify({
        property_id: propertyId,
        saved: !saveErr,
        save_error: saveErr?.message ?? null,
        listing_description: listing,
      });
    }
    case "qualify_leads": {
      /**
       * Delegates to `runLeadQualifierAgent(userId)` — the specialist uses its own DB client and rules.
       * Optional `lead_id` in tool input (not required by schema) scopes pre-checks to one lead.
       */
      const optionalLeadId = args.lead_id?.trim();

      const notEligible = (reason: string, extra: Record<string, unknown>) =>
        JSON.stringify({
          parse_ok: false,
          persisted: [] as { id: string; qualified_status: string; score?: number }[],
          error: "qualification_skipped",
          reason,
          details: extra,
        });

      if (optionalLeadId) {
        const { data: lead, error: leadErr } = await supabase
          .from("leads")
          .select("id, status, qualified_status")
          .eq("id", optionalLeadId)
          .eq("user_id", userId)
          .maybeSingle();

        if (leadErr) {
          return JSON.stringify({
            parse_ok: false,
            persisted: [],
            error: "database_error",
            details: { message: leadErr.message },
          });
        }
        if (!lead) {
          return notEligible("lead_not_found", { lead_id: optionalLeadId });
        }

        const pipeline = normalizePipelineStatus(lead.status);
        const qs = normalizePipelineStatus(lead.qualified_status);

        if (qs !== "pending") {
          return notEligible("qualified_status_not_pending", {
            lead_id: optionalLeadId,
            qualified_status: lead.qualified_status ?? null,
          });
        }
        if (pipeline !== "new") {
          return notEligible("pipeline_status_not_new", {
            lead_id: optionalLeadId,
            status: lead.status ?? null,
          });
        }
      } else {
        const { data: anyEligible, error: eligErr } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "new")
          .eq("qualified_status", "pending")
          .limit(1);

        if (eligErr) {
          return JSON.stringify({
            parse_ok: false,
            persisted: [],
            error: "database_error",
            details: { message: eligErr.message },
          });
        }
        if (!anyEligible?.length) {
          return JSON.stringify({
            parse_ok: true,
            persisted: [],
            details: {
              message:
                "No eligible leads: the specialist requires pipeline status new and qualification pending.",
            },
          });
        }
      }

      let results: Awaited<ReturnType<typeof runLeadQualifierAgent>>;
      try {
        /** Session-scoped client — same as rent chaser / API route so RLS updates succeed. */
        results = await runLeadQualifierAgent(userId, { supabase });
      } catch (e) {
        return JSON.stringify({
          parse_ok: false,
          persisted: [],
          error: "lead_qualifier_agent_failed",
          details: { message: e instanceof Error ? e.message : String(e) },
        });
      }

      const persistedAll = results.map((r) => ({
        id: r.leadId,
        qualified_status: r.recommendation === "qualify" ? "qualified" : "disqualified",
        score: r.score,
      }));

      if (optionalLeadId) {
        const hit = results.find((r) => r.leadId === optionalLeadId);
        if (!hit) {
          return JSON.stringify({
            parse_ok: false,
            persisted: persistedAll,
            error: "target_lead_not_in_result",
            reason:
              "The specialist ran but did not return this lead (e.g. skipped during processing). Check /dashboard/leads.",
            details: {
              lead_id: optionalLeadId,
              processed_count: results.length,
              processed_lead_ids: results.map((r) => r.leadId),
            },
          });
        }
        return JSON.stringify({
          parse_ok: true,
          persisted: [
            {
              id: hit.leadId,
              qualified_status: hit.recommendation === "qualify" ? "qualified" : "disqualified",
              score: hit.score,
            },
          ],
          details: {
            fullName: hit.fullName,
            score: hit.score,
            recommendation: hit.recommendation,
            reasoning: hit.reasoning,
            actionId: hit.actionId,
          },
        });
      }

      return JSON.stringify({
        parse_ok: results.length > 0,
        persisted: persistedAll,
        details: {
          total_processed: results.length,
          results: results.map((r) => ({
            leadId: r.leadId,
            fullName: r.fullName,
            score: r.score,
            recommendation: r.recommendation,
            reasoning: r.reasoning,
          })),
        },
      });
    }
    case "nurture_lead": {
      const leadId = args.lead_id?.trim();
      const rawStep = (args.step ?? "").trim();
      const step =
        rawStep === "initial_contact" || rawStep === "viewing" || rawStep === "application"
          ? rawStep
          : null;
      if (!leadId || !step) {
        return JSON.stringify({ error: "lead_id and step (initial_contact | viewing | application) are required." });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select(
          "id, user_id, property_id, full_name, name, email, phone, budget, move_in_date, qualified_status, status, notes",
        )
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const qualified = normalizePipelineStatus(lead.qualified_status);
      if (qualified !== "qualified") {
        return JSON.stringify({
          error: "This lead must be qualified before nurture. Run qualify_leads or use the Leads dashboard first.",
          qualified_status: lead.qualified_status ?? null,
        });
      }

      const toEmail = (lead.email ?? "").trim();
      if (!toEmail) {
        return JSON.stringify({ error: "Lead has no email address; add one on the lead record before nurturing." });
      }

      let propertyAddress = "the property";
      if (lead.property_id) {
        const { data: prop } = await supabase
          .from("properties")
          .select("address, city, postcode")
          .eq("id", lead.property_id as string)
          .eq("user_id", userId)
          .maybeSingle();
        if (prop) {
          const parts = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");
          if (parts.trim()) propertyAddress = parts.trim();
        }
      }

      const current = normalizePipelineStatus(lead.status);
      type NurtureStep = "initial_contact" | "viewing" | "application";
      const expected: Record<NurtureStep, { from: string; to: string }> = {
        initial_contact: { from: "new", to: "contacted" },
        viewing: { from: "contacted", to: "viewing" },
        application: { from: "viewing", to: "applied" },
      };

      const transition = expected[step];
      if (current !== transition.from) {
        return JSON.stringify({
          error: `Wrong pipeline stage for this step. Current status is "${current}"; expected "${transition.from}" for ${step}.`,
          current_status: current,
          expected_status: transition.from,
        });
      }

      const leadName = displayLeadName(lead);
      const stepLabel =
        step === "initial_contact"
          ? "initial contact after their enquiry"
          : step === "viewing"
            ? "scheduling or confirming a viewing"
            : "inviting them to complete the tenancy application";

      const subject =
        step === "initial_contact"
          ? "Re: your property enquiry"
          : step === "viewing"
            ? "Viewing arrangement"
            : "Tenancy application — next steps";

      const draft = await runLLM({
        agentName: "ceo",
        messages: [
          {
            role: "system",
            content:
              "You write concise, professional UK landlord emails to prospective tenants. Output plain text only (no subject line). 3–4 short paragraphs max. Warm but businesslike.",
          },
          {
            role: "user",
            content: `Draft an email to ${leadName} (${toEmail}) about ${propertyAddress}, for ${stepLabel}. Context: budget ${lead.budget ?? "n/a"}, move-in preference ${lead.move_in_date ?? "n/a"}.`,
          },
        ],
        maxTokens: 600,
      });

      const body = draft.text.trim();
      const emailResult = await sendEmailTool(supabase, userId, null, {
        to: toEmail,
        toName: leadName,
        subject,
        body,
        agentType: "lead",
      });

      const noteLine = `Nurture (${step}): email ${emailResult.sent ? "sent" : "saved as draft"} — ${emailResult.message}`;
      const note = appendLeadNote(lead.notes as string | null, noteLine);

      const { error: upErr } = await supabase
        .from("leads")
        .update({
          status: transition.to,
          notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      if (upErr) {
        return JSON.stringify({
          error: `Email prepared but could not update lead: ${upErr.message}`,
          email_sent: emailResult.sent,
          email_log_id: emailResult.emailLogId,
        });
      }

      return JSON.stringify({
        lead_id: leadId,
        step,
        previous_status: transition.from,
        new_status: transition.to,
        email_draft_or_sent: emailResult.sent ? "sent" : "draft",
        email_log_id: emailResult.emailLogId,
        email_message: emailResult.message,
      });
    }
    case "decide_lead_application": {
      const leadId = args.lead_id?.trim();
      const rawDecision = (args.decision ?? "").trim().toLowerCase();
      const decision = rawDecision === "approved" || rawDecision === "rejected" ? rawDecision : null;
      if (!leadId || !decision) {
        return JSON.stringify({ error: "lead_id and decision (approved | rejected) are required." });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, status, notes")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const current = normalizePipelineStatus(lead.status);
      if (current !== "applied") {
        return JSON.stringify({
          error: `Landlord decision applies only to leads in the applied stage. Current status: "${current}".`,
          current_status: current,
        });
      }

      const newStatus = decision === "approved" ? "approved" : "rejected";
      const note = appendLeadNote(lead.notes as string | null, `Landlord decision: ${decision}`);

      const { error: upErr } = await supabase
        .from("leads")
        .update({
          status: newStatus,
          notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      if (upErr) {
        return JSON.stringify({ error: upErr.message });
      }

      return JSON.stringify({
        lead_id: leadId,
        decision,
        new_status: newStatus,
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
        .select(
          "id, full_name, email, tenancies(id, property_id, status, properties(address, city))",
        )
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
