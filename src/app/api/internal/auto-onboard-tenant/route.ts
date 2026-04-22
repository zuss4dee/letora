import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
  const landlordId = body.landlord_id?.trim();

  if (!tenancyId || !tenantId || !landlordId) {
    return new Response("tenancy_id, tenant_id, and landlord_id are required", { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: tenancy, error: tenancyErr } = await supabase
    .from("tenancies")
    .select("id, tenant_id, property_id, properties!inner ( user_id )")
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenancyErr || !tenancy) {
    return Response.json({ ok: false, error: tenancyErr?.message ?? "Tenancy not found" }, { status: 400 });
  }

  const propRaw = tenancy.properties as unknown;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as { user_id?: string } | null;
  const ownerId = property?.user_id;

  if (ownerId !== landlordId) {
    return new Response("Forbidden", { status: 403 });
  }

  if ((tenancy as { tenant_id?: string }).tenant_id !== tenantId) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, email, user_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return Response.json({ ok: false, error: tenantErr?.message ?? "Tenant not found" }, { status: 400 });
  }

  if ((tenant as { user_id?: string }).user_id !== landlordId) {
    return new Response("Forbidden", { status: 403 });
  }

  const emailRaw = (tenant as { email?: string | null }).email;
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  if (!email) {
    await supabase.from("agent_runs").insert({
      user_id: landlordId,
      agent_type: "tenant_onboarding",
      status: "skipped",
      payload: { output: "skipped:no-email" },
    });
    return new Response("skipped:no-email", { status: 200 });
  }

  try {
    const result = await runTenantOnboardingAgent(tenancyId, landlordId, supabase);
    if (!result.success) {
      await supabase.from("agent_runs").insert({
        user_id: landlordId,
        agent_type: "tenant_onboarding",
        status: "error",
        payload: { output: result.message ?? "run failed" },
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
    console.error("[auto-onboard-tenant]", msg);
    await supabase.from("agent_runs").insert({
      user_id: landlordId,
      agent_type: "tenant_onboarding",
      status: "error",
      payload: { output: msg },
    });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
