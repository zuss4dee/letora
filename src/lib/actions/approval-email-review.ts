"use server";

import { revalidatePath } from "next/cache";

import { approveAgentApproval, type ApproveAgentApprovalResult } from "@/lib/actions/agent-approvals";
import type { SendRentChaseEmailApprovalPayload } from "@/lib/approvals/types";
import { createClient } from "@/lib/supabase/server";

const LETORA_ORIGINAL_EMAIL_KEY = "_letoraOriginalEmail" as const;

type OriginalEmailSnapshot = {
  subject: string;
  body: string;
};

type ActionOk = { ok: true } | { ok: false; error: string };

export type ApprovalEmailReviewContext = {
  approvalId: string;
  agentRunId: string | null;
  actionType: "send_rent_chase_email";
  tenantEmail: string;
  subject: string;
  body: string;
  originalSubject: string;
  originalBody: string;
  tenantName: string;
  propertyAddress: string;
  amountOwed: number;
  daysOverdue: number;
  dueDate: string | null;
};

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readOriginalSnapshot(payload: Record<string, unknown>): OriginalEmailSnapshot | null {
  const raw = payload[LETORA_ORIGINAL_EMAIL_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const subject = typeof o.subject === "string" ? o.subject : null;
  const body = typeof o.body === "string" ? o.body : null;
  if (subject === null || body === null) return null;
  return { subject, body };
}

function readRentChasePayload(payload: Record<string, unknown>): SendRentChaseEmailApprovalPayload | null {
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const rentPaymentId = typeof payload.rentPaymentId === "string" ? payload.rentPaymentId : "";
  const tenantEmail = typeof payload.tenantEmail === "string" ? payload.tenantEmail : "";
  const tenantName = typeof payload.tenantName === "string" ? payload.tenantName : "";
  if (!userId || !rentPaymentId || !tenantEmail) return null;
  const emailSubject = typeof payload.emailSubject === "string" ? payload.emailSubject : "";
  const emailBody = typeof payload.emailBody === "string" ? payload.emailBody : "";
  const amountOwed = typeof payload.amountOwed === "number" ? payload.amountOwed : Number(payload.amountOwed) || 0;
  const daysOverdue = typeof payload.daysOverdue === "number" ? payload.daysOverdue : Number(payload.daysOverdue) || 0;
  return {
    userId,
    rentPaymentId,
    tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
    propertyId: typeof payload.propertyId === "string" ? payload.propertyId : null,
    tenantEmail,
    tenantName,
    emailSubject,
    emailBody,
    amountOwed,
    daysOverdue,
    dueDate: typeof payload.dueDate === "string" ? payload.dueDate : null,
    emailDraftId: typeof payload.emailDraftId === "string" ? payload.emailDraftId : null,
  };
}

const EMAIL_REVIEW_REVALIDATE_PATHS = [
  "/dashboard/approvals",
  "/dashboard",
  "/dashboard/emails",
] as const;

function revalidateEmailReviewSurfaces(approvalId: string) {
  for (const p of EMAIL_REVIEW_REVALIDATE_PATHS) {
    revalidatePath(p);
  }
  revalidatePath(`/dashboard/approvals/${approvalId}/email`);
}

/**
 * Load a pending rent-chase approval for the email review route (`agent_approvals.id`).
 * Execution after approve reads {@link agent_approvals.payload} — drafts must be persisted there
 * (and mirrored on the linked `agent_runs.payload` when present).
 */
export async function getApprovalEmailReviewContext(
  approvalId: string,
): Promise<ApprovalEmailReviewContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const id = approvalId.trim();
  if (!id) return null;

  const { data: approval, error: apErr } = await supabase
    .from("agent_approvals")
    .select("id,user_id,agent_run_id,action_type,status,payload,evidence")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (apErr || !approval) return null;
  if (approval.status !== "pending") return null;
  if (approval.action_type !== "send_rent_chase_email") return null;

  const payload = asRecord(approval.payload);
  const parsed = readRentChasePayload(payload);
  if (!parsed) return null;

  const evidence = asRecord(approval.evidence);
  const propertyAddress =
    typeof evidence.propertyAddress === "string" && evidence.propertyAddress.trim() !== ""
      ? evidence.propertyAddress.trim()
      : "—";

  let runPayload: Record<string, unknown> = {};
  if (approval.agent_run_id) {
    const { data: runRow } = await supabase
      .from("agent_runs")
      .select("payload")
      .eq("id", approval.agent_run_id)
      .eq("user_id", user.id)
      .maybeSingle();
    runPayload = asRecord(runRow?.payload);
  }

  const subject = parsed.emailSubject.trim();
  const body = parsed.emailBody.trim();

  const snap = readOriginalSnapshot(payload);
  const runSubject = typeof runPayload.emailSubject === "string" ? runPayload.emailSubject : "";
  const runBody = typeof runPayload.emailBody === "string" ? runPayload.emailBody : "";

  const originalSubject = snap?.subject ?? (runSubject || subject);
  const originalBody = snap?.body ?? (runBody || body);

  return {
    approvalId: approval.id,
    agentRunId: approval.agent_run_id,
    actionType: "send_rent_chase_email",
    tenantEmail: parsed.tenantEmail,
    subject,
    body,
    originalSubject,
    originalBody,
    tenantName: parsed.tenantName || "Tenant",
    propertyAddress,
    amountOwed: parsed.amountOwed,
    daysOverdue: parsed.daysOverdue,
    dueDate: parsed.dueDate,
  };
}

export async function saveApprovalEmailDraft(input: {
  approvalId: string;
  subject: string;
  body: string;
}): Promise<ActionOk> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const approvalId = input.approvalId.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!approvalId) return { ok: false, error: "Missing approval id" };
  if (!subject) return { ok: false, error: "Subject is required" };
  if (!body) return { ok: false, error: "Email body is required" };

  const { data: row, error: fetchErr } = await supabase
    .from("agent_approvals")
    .select("id,payload,agent_run_id,status,action_type")
    .eq("id", approvalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: fetchErr?.message ?? "Approval not found" };
  if (row.status !== "pending") return { ok: false, error: "Approval is no longer pending" };
  if (row.action_type !== "send_rent_chase_email") {
    return { ok: false, error: "This approval does not support email draft editing" };
  }

  const prev = asRecord(row.payload);
  const parsed = readRentChasePayload(prev);
  if (!parsed) return { ok: false, error: "Invalid approval payload" };

  const nextApprovalPayload: Record<string, unknown> = {
    ...prev,
    emailSubject: subject,
    emailBody: body,
  };

  if (!readOriginalSnapshot(prev)) {
    nextApprovalPayload[LETORA_ORIGINAL_EMAIL_KEY] = {
      subject: String(prev.emailSubject ?? ""),
      body: String(prev.emailBody ?? ""),
    };
  }

  const { error: upAp } = await supabase
    .from("agent_approvals")
    .update({ payload: nextApprovalPayload })
    .eq("id", approvalId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (upAp) return { ok: false, error: upAp.message };

  if (row.agent_run_id) {
    const { data: runRow } = await supabase
      .from("agent_runs")
      .select("payload")
      .eq("id", row.agent_run_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const runPrev = asRecord(runRow?.payload);
    const nextRunPayload: Record<string, unknown> = {
      ...runPrev,
      emailSubject: subject,
      emailBody: body,
    };
    if (!readOriginalSnapshot(runPrev)) {
      nextRunPayload[LETORA_ORIGINAL_EMAIL_KEY] = {
        subject: String(runPrev.emailSubject ?? ""),
        body: String(runPrev.emailBody ?? ""),
      };
    }

    const { error: upRun } = await supabase
      .from("agent_runs")
      .update({ payload: nextRunPayload })
      .eq("id", row.agent_run_id)
      .eq("user_id", user.id);

    if (upRun) return { ok: false, error: upRun.message };
  }

  revalidateEmailReviewSurfaces(approvalId);
  return { ok: true };
}

/** Persists the latest subject/body, then runs the standard approve → send pipeline. */
export async function approveAndSendApprovalEmail(input: {
  approvalId: string;
  subject: string;
  body: string;
}): Promise<ApproveAgentApprovalResult> {
  const saved = await saveApprovalEmailDraft({
    approvalId: input.approvalId,
    subject: input.subject,
    body: input.body,
  });
  if (saved.ok === false) {
    return { ok: false, error: saved.error };
  }
  return approveAgentApproval(input.approvalId.trim());
}
