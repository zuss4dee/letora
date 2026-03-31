import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled rent chaser. Protect with CRON_SECRET (e.g. Vercel Cron: Authorization: Bearer …).
 * Requires SUPABASE_SERVICE_ROLE_KEY to iterate users.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 501 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: rows, error } = await admin.from("user_settings").select("user_id");
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let processed = 0;
  const errors: string[] = [];
  for (const row of rows ?? []) {
    try {
      await runRentChaserAgent(row.user_id, { supabase: admin });
      processed += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return Response.json({ ok: true, processed, errors: errors.length ? errors : undefined });
}
