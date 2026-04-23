import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed) return null;
  const m = /^Bearer\s+(.+)$/i.exec(trimmed);
  return m?.[1]?.trim() ?? trimmed;
}

type AutoOnboardBody = {
  tenancy_id?: string;
  tenant_id?: string;
  property_id?: string;
  landlord_id?: string;
  rent_amount?: unknown;
  move_in_date?: string | null;
};

function logAutoOnboardEvent(payload: Record<string, unknown>) {
  console.error(`[auto-onboard-tenant] ${JSON.stringify(payload)}`);
}

async function recordAutoOnboardSkip(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    tenancyId: string;
    tenantId: string;
    runCorrelationId: string;
    reason: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  const rowPayload: Record<string, unknown> = {
    output: "auto_onboard_skip",
    skip_reason: opts.reason,
    tenancy_id: opts.tenancyId,
    tenant_id: opts.tenantId,
    run_correlation_id: opts.runCorrelationId,
  };
  if (opts.detail) rowPayload.detail = opts.detail;

  const { error } = await supabase.from("agent_runs").insert({
    user_id: opts.userId,
    agent_type: "tenant_onboarding",
    status: "skipped",
    payload: rowPayload,
  });
  if (error) {
    logAutoOnboardEvent({
      event: "skip_row_insert_failed",
      message: error.message,
      skip_reason: opts.reason,
      tenancy_id: opts.tenancyId,
      tenant_id: opts.tenantId,
      run_correlation_id: opts.runCorrelationId,
    });
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 501 });
  }
  const debugBypass = request.headers.get("x-letora-debug") === "allow-internal-auto-onboard";
  if (debugBypass) {
    console.log("debug bypass used");
  }
  const token = bearerToken(request);
  console.log("route expected prefix", secret.slice(0, 12), "len", secret.length);
  console.log("route got prefix", (token ?? "").slice(0, 12), "len", (token ?? "").length);
  if (!debugBypass && token !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: AutoOnboardBody;
  try {
    body = (await request.json()) as AutoOnboardBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const tenancyId = body.tenancy_id?.trim();
  const tenantId = body.tenant_id?.trim();

  if (!tenancyId || !tenantId) {
    logAutoOnboardEvent({
      event: "auto_onboard_reject",
      reason: "missing_tenancy_or_tenant_id",
      tenancy_id: tenancyId ?? null,
      tenant_id: tenantId ?? null,
    });
    return new Response("tenancy_id and tenant_id are required", { status: 400 });
  }

  const runCorrelationId = crypto.randomUUID();
  const supabase = createServiceRoleClient();

  const { data: tenancy, error: tenancyErr } = await supabase
    .from("tenancies")
    .select("id, tenant_id, property_id, properties!inner ( user_id )")
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenancyErr || !tenancy) {
    logAutoOnboardEvent({
      event: "auto_onboard_reject",
      reason: "tenancy_not_found",
      tenancy_id: tenancyId,
      tenant_id: tenantId,
      run_correlation_id: runCorrelationId,
      detail: tenancyErr?.message ?? null,
    });
    return Response.json({ ok: false, error: tenancyErr?.message ?? "Tenancy not found" }, { status: 400 });
  }

  const propRaw = tenancy.properties as unknown;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as { user_id?: string | null } | null;
  const ownerRaw = property?.user_id;
  const ownerId = typeof ownerRaw === "string" && ownerRaw.trim() !== "" ? ownerRaw.trim() : null;

  if (!ownerId) {
    logAutoOnboardEvent({
      event: "auto_onboard_skip",
      reason: "property_owner_null",
      tenancy_id: tenancyId,
      tenant_id: tenantId,
      run_correlation_id: runCorrelationId,
    });
    return Response.json({ ok: false, error: "Property has no owner user_id" }, { status: 400 });
  }

  /** Authoritative landlord for onboarding = property owner (matches `runTenantOnboardingAgent`). */
  const landlordId = ownerId;

  const claimedLandlord =
    typeof body.landlord_id === "string" && body.landlord_id.trim() !== ""
      ? body.landlord_id.trim()
      : null;
  if (claimedLandlord && claimedLandlord !== landlordId) {
    await recordAutoOnboardSkip(supabase, {
      userId: landlordId,
      tenancyId,
      tenantId,
      runCorrelationId,
      reason: "landlord_claim_mismatch",
      detail: { claimed_landlord_id: claimedLandlord, property_owner_id: landlordId },
    });
    return new Response("Forbidden", { status: 403 });
  }

  if ((tenancy as { tenant_id?: string }).tenant_id !== tenantId) {
    await recordAutoOnboardSkip(supabase, {
      userId: landlordId,
      tenancyId,
      tenantId,
      runCorrelationId,
      reason: "tenancy_tenant_id_mismatch",
      detail: { tenancy_tenant_id: (tenancy as { tenant_id?: string }).tenant_id ?? null },
    });
    return new Response("Forbidden", { status: 403 });
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, email, user_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr || !tenant) {
    logAutoOnboardEvent({
      event: "auto_onboard_reject",
      reason: "tenant_not_found",
      tenancy_id: tenancyId,
      tenant_id: tenantId,
      run_correlation_id: runCorrelationId,
      detail: tenantErr?.message ?? null,
    });
    return Response.json({ ok: false, error: tenantErr?.message ?? "Tenant not found" }, { status: 400 });
  }

  /**
   * Align with `runTenantOnboardingAgent`: workspace is scoped by property owner only.
   * Legacy/import rows may have `tenants.user_id` null; treat as landlord-owned unless explicitly another user.
   */
  const tenantUserIdRaw = (tenant as { user_id?: string | null }).user_id;
  if (tenantUserIdRaw != null && tenantUserIdRaw.trim() !== "" && tenantUserIdRaw !== landlordId) {
    await recordAutoOnboardSkip(supabase, {
      userId: landlordId,
      tenancyId,
      tenantId,
      runCorrelationId,
      reason: "tenant_user_id_foreign_to_landlord",
      detail: { tenant_user_id: tenantUserIdRaw },
    });
    return new Response("Forbidden", { status: 403 });
  }

  const emailRaw = (tenant as { email?: string | null }).email;
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  if (!email) {
    await supabase.from("agent_runs").insert({
      user_id: landlordId,
      agent_type: "tenant_onboarding",
      status: "skipped",
      payload: {
        output: "auto_onboard_skip",
        skip_reason: "no_tenant_email",
        tenancy_id: tenancyId,
        tenant_id: tenantId,
        run_correlation_id: runCorrelationId,
      },
    });
    return new Response("skipped:no-email", { status: 200 });
  }

  try {
    const result = await runTenantOnboardingAgent(tenancyId, landlordId, supabase, {
      runCorrelationId,
    });
    if (!result.success) {
      await supabase.from("agent_runs").insert({
        user_id: landlordId,
        agent_type: "tenant_onboarding",
        status: "error",
        payload: {
          output: result.message ?? "run failed",
          skip_reason: "agent_run_failed",
          tenancy_id: tenancyId,
          tenant_id: tenantId,
          run_correlation_id: runCorrelationId,
        },
      });
      return Response.json(
        { ok: false, message: result.message },
        { status: result.message === "Forbidden" ? 403 : 400 },
      );
    }
    return Response.json({
      ok: true,
      agentRunId: result.agentRunId,
      tasksCreated: result.tasksCreated,
      emailStatus: result.emailStatus,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAutoOnboardEvent({
      event: "auto_onboard_exception",
      tenancy_id: tenancyId,
      tenant_id: tenantId,
      run_correlation_id: runCorrelationId,
      message: msg,
    });
    await supabase.from("agent_runs").insert({
      user_id: landlordId,
      agent_type: "tenant_onboarding",
      status: "error",
      payload: {
        output: msg,
        skip_reason: "exception",
        tenancy_id: tenancyId,
        tenant_id: tenantId,
        run_correlation_id: runCorrelationId,
      },
    });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
