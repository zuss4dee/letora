import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed) return null;
  const m = /^Bearer\s+(.+)$/i.exec(trimmed);
  return m?.[1]?.trim() ?? trimmed;
}

/** Minimal debug list: last 100 inbound events (service role; same auth pattern as auto-onboard). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 501 });
  }
  const token = bearerToken(request);
  if (token !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("inbound_integration_events")
    .select("id,source,type,status,idempotency_key,created_at,processed_at,error_message")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, events: data ?? [] });
}
