import { processStaleApprovalReminders } from "@/lib/approvals/stale-approval-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron: idempotent operator email reminders for approvals pending past the stale threshold
 * (see {@link APPROVAL_PENDING_STALE_MS} in queue-stats / `processStaleApprovalReminders`).
 *
 * **Schedule:** `vercel.json` → `crons` (default: daily 08:00 UTC). Safe to run often; cooldowns live in evidence.
 *
 * **Auth:** `Authorization: Bearer ${CRON_SECRET}` — Vercel injects this header on cron invocations when `CRON_SECRET` is set.
 *
 * **Env:** `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (optional, for links in email).
 *
 * Manual / alternate callers can use `GET /api/internal/stale-approval-reminders` with the same bearer token.
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
    `[cron/stale-approval-reminders] done elapsedMs=${elapsedMs} ok=${String(result.ok)} scanned=${result.scanned} eligible=${result.eligible} emailsSent=${result.emailsSent} approvalsMarked=${result.approvalsMarked} errors=${result.errors.length}`,
  );
  if (result.errors.length > 0) {
    console.warn(`[cron/stale-approval-reminders] errors: ${result.errors.join(" | ")}`);
  }

  const failedCompletely =
    result.eligible > 0 && result.approvalsMarked === 0 && result.errors.length > 0;
  const { ok, ...rest } = result;
  return Response.json({ ok, cron: "stale-approval-reminders", elapsedMs, ...rest }, { status: failedCompletely ? 500 : 200 });
}
