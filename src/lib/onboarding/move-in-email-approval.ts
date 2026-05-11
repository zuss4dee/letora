import type { SupabaseClient } from "@supabase/supabase-js";

import { createAgentApproval } from "@/lib/actions/agent-approvals";
import type { CreateAgentApprovalContract, SendMoveInEmailEvidence } from "@/lib/approvals/types";
import { composeMoveInEmailContent, loadMoveInTenancyBundle } from "@/lib/onboarding/send-move-in-email";

export async function buildMoveInEmailApprovalPackage(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  opts?: { agentRunId?: string | null },
): Promise<{ ok: true; contract: CreateAgentApprovalContract } | { ok: false; error: string }> {
  const bundle = await loadMoveInTenancyBundle(supabase, tenancyId, userId);
  if (!bundle) {
    return { ok: false, error: "Tenancy not found" };
  }
  const email = bundle.tenant.email?.trim();
  if (!email) {
    return { ok: false, error: "Tenant has no email on file" };
  }

  const { subject, body } = composeMoveInEmailContent(bundle);
  const addressLabel = [bundle.property.address, bundle.property.city, bundle.property.postcode]
    .filter(Boolean)
    .join(", ");
  const moveInResolved = bundle.moveInDate ?? bundle.startDate;
  const bodyPreview = body.length > 420 ? `${body.slice(0, 417)}…` : body;

  const evidence: SendMoveInEmailEvidence = {
    tenantId: bundle.tenantId,
    tenantName: bundle.tenant.full_name?.trim() || "Tenant",
    tenantEmail: email,
    propertyAddress: addressLabel || "—",
    moveInDate: moveInResolved,
    subject,
    bodyPreview,
  };

  const contract: CreateAgentApprovalContract = {
    agentRunId: opts?.agentRunId ?? null,
    agentType: "tenant_onboarding",
    title: "Approve move-in instructions email",
    summary: `${evidence.propertyAddress} · ${evidence.tenantName}`,
    actionType: "send_move_in_email",
    targetType: "tenancy",
    targetId: tenancyId,
    payload: {
      userId,
      tenancyId,
      emailSubject: subject,
      emailBody: body,
    },
    evidence: { ...evidence },
  };

  return { ok: true, contract };
}

/**
 * Creates a pending `send_move_in_email` approval (CEO tool, confirm move-in, etc.).
 */
export async function enqueueMoveInEmailApproval(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  opts?: { agentRunId?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const pack = await buildMoveInEmailApprovalPackage(supabase, tenancyId, userId, opts);
  if (pack.ok === false) {
    return { ok: false, error: pack.error };
  }
  return createAgentApproval(pack.contract, { supabase, userId });
}
