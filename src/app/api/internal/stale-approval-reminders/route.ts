import { processStaleApprovalReminders } from "@/lib/approvals/stale-approval-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Sends idempotent email reminders for agent approvals pending past the stale threshold
 * ({@link APPROVAL_PENDING_STALE_MS} in queue-stats). Audited in `agent_approvals.evidence._letora_stale_reminder`.
 *
 * **Production schedule:** Vercel Cron hits `/api/cron/stale-approval-reminders` (see `vercel.json`).
 * This route stays available for manual runs, Supabase Edge, or other callers with the same auth.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (same pattern as `/api/cron/rent-chase`).
 */
export async function GET(_request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 501 });
  }
  const auth = _request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = Date.now();
  const result = await processStaleApprovalReminders();
  const elapsedMs = Date.now() - started;

  console.info(
    `[internal/stale-approval-reminders] done elapsedMs=${elapsedMs} ok=${String(result.ok)} scanned=${result.scanned} eligible=${result.eligible} emailsSent=${result.emailsSent} approvalsMarked=${result.approvalsMarked} errors=${result.errors.length}`,
  );
  if (result.errors.length > 0) {
    console.warn(`[internal/stale-approval-reminders] errors: ${result.errors.join(" | ")}`);
  }

  const failedCompletely =
    result.eligible > 0 && result.approvalsMarked === 0 && result.errors.length > 0;
  const { ok, ...rest } = result;
  return Response.json({ ok, elapsedMs, ...rest }, { status: failedCompletely ? 500 : 200 });
}
