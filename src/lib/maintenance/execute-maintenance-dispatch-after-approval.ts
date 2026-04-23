import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmailTool } from "@/lib/tools/send-email";

export type ExecuteMaintenanceDispatchAfterApprovalResult =
  | { ok: true; kind: "sent"; emailLogId: string }
  | { ok: true; kind: "already_sent"; emailLogId: string | null }
  | { ok: false; error: string };

function readPayloadUserId(payload: Record<string, unknown>): string | null {
  const raw = payload.userId;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function readMaintenanceRequestId(payload: Record<string, unknown>, targetId: string | null): string | null {
  const raw = payload.maintenanceRequestId;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof targetId === "string" && targetId.trim() !== "") return targetId.trim();
  return null;
}

async function assertMaintenanceRequestOwned(
  supabase: SupabaseClient,
  userId: string,
  maintenanceRequestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reqRow, error } = await supabase
    .from("maintenance_requests")
    .select("id, tenancies!inner(properties!inner(user_id))")
    .eq("id", maintenanceRequestId)
    .maybeSingle();

  if (error || !reqRow) {
    return { ok: false, error: error?.message ?? "Maintenance request not found" };
  }

  const tenRaw = reqRow.tenancies as unknown;
  const tenancy = Array.isArray(tenRaw) ? tenRaw[0] : tenRaw;
  if (!tenancy || typeof tenancy !== "object") {
    return { ok: false, error: "Invalid maintenance linkage" };
  }
  const propRaw = (tenancy as { properties?: unknown }).properties;
  const property = Array.isArray(propRaw) ? propRaw[0] : propRaw;
  const ownerId =
    property && typeof property === "object" && "user_id" in property
      ? (property as { user_id?: string }).user_id
      : undefined;
  if (ownerId !== userId) {
    return { ok: false, error: "Forbidden" };
  }

  return { ok: true };
}

async function findExistingMaintenanceDispatchSend(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string | null,
): Promise<string | null> {
  if (!agentRunId) return null;

  const { data: logRow } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_run_id", agentRunId)
    .eq("agent_type", "maintenance")
    .eq("template_type", "dispatch")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (logRow?.id && typeof logRow.id === "string") return logRow.id;
  return null;
}

async function applyContractorAssignment(
  supabase: SupabaseClient,
  maintenanceRequestId: string,
  contractorName: string,
  contractorEmail: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("maintenance_requests")
    .update({
      contractor_name: contractorName,
      contractor_email: contractorEmail,
      status: "in_progress",
      updated_at: now,
    })
    .eq("id", maintenanceRequestId);
}

async function mergeAgentRunAfterMaintenanceDispatch(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string,
  approvalId: string,
  emailLogId: string,
): Promise<void> {
  const { data: runRow } = await supabase
    .from("agent_runs")
    .select("payload")
    .eq("id", agentRunId)
    .eq("user_id", userId)
    .maybeSingle();

  const prevPayload =
    runRow?.payload && typeof runRow.payload === "object" && !Array.isArray(runRow.payload)
      ? (runRow.payload as Record<string, unknown>)
      : {};

  await supabase
    .from("agent_runs")
    .update({
      payload: {
        ...prevPayload,
        maintenanceDispatchEmailLogId: emailLogId,
        maintenanceDispatchSentAfterApprovalId: approvalId,
      },
    })
    .eq("id", agentRunId)
    .eq("user_id", userId);
}

function revalidateMaintenanceSurfaces(maintenanceRequestId: string) {
  revalidatePath("/dashboard/maintenance");
  revalidatePath(`/dashboard/maintenance/${maintenanceRequestId}`);
}

/**
 * Contractor dispatch email after dashboard approval. Uses `forceSend` so human approval
 * is not blocked by `auto_send_maintenance_updates`.
 */
export async function executeMaintenanceDispatchAfterApproval(
  supabase: SupabaseClient,
  userId: string,
  approval: {
    id: string;
    agent_run_id: string | null;
    payload: Record<string, unknown>;
    target_id: string | null;
  },
): Promise<ExecuteMaintenanceDispatchAfterApprovalResult> {
  const payloadUserId = readPayloadUserId(approval.payload);
  if (payloadUserId !== userId) {
    return { ok: false, error: "Approval payload does not match current user" };
  }

  const maintenanceRequestId = readMaintenanceRequestId(approval.payload, approval.target_id);
  if (!maintenanceRequestId) {
    return { ok: false, error: "Missing maintenance request id on approval" };
  }

  const owned = await assertMaintenanceRequestOwned(supabase, userId, maintenanceRequestId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }

  const contractorEmail =
    typeof approval.payload.contractorEmail === "string" ? approval.payload.contractorEmail.trim() : "";
  const contractorName =
    typeof approval.payload.contractorName === "string" && approval.payload.contractorName.trim() !== ""
      ? approval.payload.contractorName.trim()
      : "Contractor";
  const subject =
    typeof approval.payload.emailSubject === "string" && approval.payload.emailSubject.trim() !== ""
      ? approval.payload.emailSubject.trim()
      : "Maintenance dispatch";
  const body =
    typeof approval.payload.emailBody === "string" && approval.payload.emailBody.trim() !== ""
      ? approval.payload.emailBody.trim()
      : "A maintenance request requires your attention.";

  if (!contractorEmail) {
    return { ok: false, error: "No contractor email on approval payload" };
  }

  const existingId = await findExistingMaintenanceDispatchSend(supabase, userId, approval.agent_run_id);

  if (existingId) {
    await applyContractorAssignment(supabase, maintenanceRequestId, contractorName, contractorEmail);
    if (approval.agent_run_id) {
      await mergeAgentRunAfterMaintenanceDispatch(
        supabase,
        userId,
        approval.agent_run_id,
        approval.id,
        existingId,
      );
    }
    revalidateMaintenanceSurfaces(maintenanceRequestId);
    return { ok: true, kind: "already_sent", emailLogId: existingId };
  }

  const sendResult = await sendEmailTool(supabase, userId, approval.agent_run_id, {
    to: contractorEmail,
    toName: contractorName,
    subject,
    body,
    agentType: "maintenance",
    templateType: "dispatch",
    forceSend: true,
  });

  if (!sendResult.sent) {
    return {
      ok: false,
      error: sendResult.error ?? sendResult.message ?? "Maintenance dispatch email was not sent",
    };
  }

  const emailLogId = sendResult.emailLogId;

  await applyContractorAssignment(supabase, maintenanceRequestId, contractorName, contractorEmail);

  if (approval.agent_run_id) {
    await mergeAgentRunAfterMaintenanceDispatch(supabase, userId, approval.agent_run_id, approval.id, emailLogId);
  }

  revalidateMaintenanceSurfaces(maintenanceRequestId);

  return { ok: true, kind: "sent", emailLogId };
}
