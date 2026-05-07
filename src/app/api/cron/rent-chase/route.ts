import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled rent chaser drafts (Approvals queue: `send_rent_chase_email`).
 *
 * **Production schedule:** `vercel.json` → `crons` (daily 07:00 UTC by default).
 * **Auth:** `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron sends this when `CRON_SECRET` is set in project env.
 * **Env:** `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY` (agent throws if missing while chasing).
 *
 * Iterates every `user_settings` row and runs {@link runRentChaserAgent} with the service-role client
 * (same pattern as the manual POST `/api/agents/rent-chaser`, but unattended).
 */
export async function GET(request: Request) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/rent-chase] CRON_SECRET missing — cron disabled");
    return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 501 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: rows, error } = await admin.from("user_settings").select("user_id");
  if (error) {
    console.error("[cron/rent-chase] user_settings query failed", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let processed = 0;
  /** Sum of rent-chaser agent results (one per chase draft prepared; maps to Approvals rows when email path succeeds). */
  let draftRunsReturned = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    const uid = row.user_id as string;
    try {
      const results = await runRentChaserAgent(uid, { supabase: admin, source: "cron_rent_chase" });
      processed += 1;
      draftRunsReturned += results.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${uid.slice(0, 8)}…:${msg}`);
    }
  }

  const elapsedMs = Date.now() - started;
  console.info(
    `[cron/rent-chase] done elapsedMs=${elapsedMs} usersProcessed=${processed} userSettingsRows=${rows?.length ?? 0} draftRunsReturned=${draftRunsReturned} errorCount=${errors.length}`,
  );
  if (errors.length > 0) {
    console.warn(`[cron/rent-chase] errors (sample): ${errors.slice(0, 12).join(" | ")}`);
  }

  const failedAllUsers = (rows?.length ?? 0) > 0 && processed === 0 && errors.length === (rows?.length ?? 0);
  return Response.json(
    {
      ok: true,
      cron: "rent-chase",
      elapsedMs,
      userSettingsRows: rows?.length ?? 0,
      usersProcessed: processed,
      draftRunsReturned,
      errors: errors.length ? errors : undefined,
    },
    { status: failedAllUsers ? 500 : 200 },
  );
}
