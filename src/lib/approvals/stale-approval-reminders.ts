import { Resend } from "resend";

import { buildResendFromHeader } from "@/lib/tools/send-email";
import { APPROVAL_PENDING_STALE_MS } from "@/lib/approvals/queue-stats";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatActionTypeLabel(actionType: string): string {
  return actionType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Stored on `agent_approvals.evidence` — namespaced so agent-facing evidence fields stay untouched. */
export const STALE_REMINDER_EVIDENCE_KEY = "_letora_stale_reminder";

export const APPROVAL_STALE_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type StaleReminderAudit = {
  last_sent_at: string;
  channel: "operator_email";
  send_count: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseStaleReminderAudit(evidence: Record<string, unknown> | null | undefined): StaleReminderAudit | null {
  const raw = evidence?.[STALE_REMINDER_EVIDENCE_KEY];
  if (!isRecord(raw)) return null;
  const last = raw.last_sent_at;
  if (typeof last !== "string") return null;
  const channel = raw.channel;
  if (channel !== "operator_email") return null;
  const sendCount = typeof raw.send_count === "number" && Number.isFinite(raw.send_count) ? raw.send_count : 1;
  return { last_sent_at: last, channel: "operator_email", send_count: sendCount };
}

export function approvalNeedsStaleReminder(
  row: Pick<AgentApprovalRow, "status" | "created_at" | "evidence">,
  nowMs: number = Date.now(),
  staleAfterMs: number = APPROVAL_PENDING_STALE_MS,
  cooldownMs: number = APPROVAL_STALE_REMINDER_COOLDOWN_MS,
): boolean {
  if (row.status !== "pending") return false;
  const created = new Date(row.created_at).getTime();
  if (Number.isNaN(created) || nowMs - created < staleAfterMs) return false;

  const prev = parseStaleReminderAudit(row.evidence);
  if (!prev) return true;
  const last = new Date(prev.last_sent_at).getTime();
  if (Number.isNaN(last)) return true;
  return nowMs - last >= cooldownMs;
}

function mergeReminderAudit(evidence: Record<string, unknown>, audit: StaleReminderAudit): Record<string, unknown> {
  return {
    ...evidence,
    [STALE_REMINDER_EVIDENCE_KEY]: audit,
  };
}

function shortAge(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m`;
  if (sec < 86400) return `${Math.max(1, Math.floor(sec / 3600))}h`;
  return `${Math.max(1, Math.floor(sec / 86400))}d`;
}

export type ProcessStaleApprovalRemindersResult = {
  ok: boolean;
  scanned: number;
  eligible: number;
  emailsSent: number;
  approvalsMarked: number;
  errors: string[];
};

/**
 * Finds pending approvals past the stale threshold, sends at most one batched operator email per user
 * for rows that pass the per-approval 24h reminder cooldown, then writes audit metadata into `evidence`.
 */
export async function processStaleApprovalReminders(
  admin: SupabaseClient = createServiceRoleClient(),
  nowMs: number = Date.now(),
): Promise<ProcessStaleApprovalRemindersResult> {
  const errors: string[] = [];
  const staleCutoff = new Date(nowMs - APPROVAL_PENDING_STALE_MS).toISOString();

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      scanned: 0,
      eligible: 0,
      emailsSent: 0,
      approvalsMarked: 0,
      errors: ["RESEND_API_KEY is not configured"],
    };
  }

  const { data: rows, error: fetchError } = await admin
    .from("agent_approvals")
    .select(
      "id,user_id,title,summary,action_type,created_at,evidence,status",
    )
    .eq("status", "pending")
    .lt("created_at", staleCutoff);

  if (fetchError) {
    return {
      ok: false,
      scanned: 0,
      eligible: 0,
      emailsSent: 0,
      approvalsMarked: 0,
      errors: [fetchError.message],
    };
  }

  const list = (rows ?? []) as Pick<
    AgentApprovalRow,
    "id" | "user_id" | "title" | "summary" | "action_type" | "created_at" | "evidence" | "status"
  >[];

  const eligible = list.filter((r) =>
    approvalNeedsStaleReminder(
      {
        status: r.status,
        created_at: r.created_at,
        evidence: (r.evidence ?? {}) as Record<string, unknown>,
      },
      nowMs,
    ),
  );

  if (eligible.length === 0) {
    return { ok: true, scanned: list.length, eligible: 0, emailsSent: 0, approvalsMarked: 0, errors: [] };
  }

  const byUser = new Map<string, typeof eligible>();
  for (const row of eligible) {
    const arr = byUser.get(row.user_id) ?? [];
    arr.push(row);
    byUser.set(row.user_id, arr);
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co").replace(/\/$/, "");
  const resend = new Resend(apiKey);

  let emailsSent = 0;
  let approvalsMarked = 0;

  for (const [userId, group] of byUser) {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
    const to = authData?.user?.email?.trim();
    if (authErr || !to) {
      errors.push(`No operator email for user ${userId}: ${authErr?.message ?? "missing email"}`);
      continue;
    }

    let from: string;
    try {
      const { data: settings } = await admin
        .from("user_settings")
        .select("email_from_name")
        .eq("user_id", userId)
        .maybeSingle();
      from = buildResendFromHeader((settings as { email_from_name?: string | null } | null)?.email_from_name);
    } catch {
      try {
        from = buildResendFromHeader(null);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Invalid Resend from address");
        continue;
      }
    }

    const lines = group.map((r) => {
      const age = shortAge(r.created_at, nowMs);
      const action = formatActionTypeLabel(r.action_type);
      return `• ${r.title} (${action}) — waiting ${age}`;
    });

    const subject =
      group.length === 1
        ? "Letora: an approval needs your review"
        : `Letora: ${group.length} approvals need your review`;

    const body = [
      "Some agent approvals have been pending for a while and may need your attention.",
      "",
      ...lines,
      "",
      `Review and decide in Letora: ${baseUrl}/dashboard/approvals`,
      "",
      "You will receive at most one reminder like this per approval per 24 hours while it stays pending.",
    ].join("\n");

    const { error: sendErr } = await resend.emails.send({
      from,
      to,
      subject,
      text: body,
    });

    if (sendErr) {
      errors.push(`Resend failed for ${userId}: ${sendErr.message}`);
      continue;
    }

    emailsSent += 1;
    const sentAt = new Date(nowMs).toISOString();

    for (const row of group) {
      const evidence = (row.evidence ?? {}) as Record<string, unknown>;
      const prev = parseStaleReminderAudit(evidence);
      const audit: StaleReminderAudit = {
        last_sent_at: sentAt,
        channel: "operator_email",
        send_count: (prev?.send_count ?? 0) + 1,
      };
      const nextEvidence = mergeReminderAudit(evidence, audit);

      let recorded = false;
      for (let attempt = 0; attempt < 2 && !recorded; attempt++) {
        const { error: updErr } = await admin
          .from("agent_approvals")
          .update({ evidence: nextEvidence })
          .eq("id", row.id)
          .eq("status", "pending");
        if (!updErr) {
          recorded = true;
          approvalsMarked += 1;
        } else if (attempt === 1) {
          errors.push(`Failed to record reminder for approval ${row.id}: ${updErr.message}`);
        }
      }
    }

    console.info(
      `[stale-approval-reminders] operator_email user=${userId} approvals=${group.map((g) => g.id).join(",")}`,
    );
  }

  return {
    ok: errors.length === 0,
    scanned: list.length,
    eligible: eligible.length,
    emailsSent,
    approvalsMarked,
    errors,
  };
}
