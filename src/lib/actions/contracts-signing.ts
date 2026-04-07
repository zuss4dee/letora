"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function confirmMoveIn(
  contractId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, tenancy_id, status")
    .eq("id", contractId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !contract) {
    return { ok: false, error: "Contract not found" };
  }

  if (contract.status !== "signed") {
    return { ok: false, error: "Contract must be signed by both parties before confirming move-in" };
  }

  const now = new Date().toISOString();

  const { error: contractErr } = await supabase
    .from("contracts")
    .update({ status: "active", updated_at: now })
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (contractErr) {
    return { ok: false, error: contractErr.message };
  }

  const tenancyId = contract.tenancy_id as string | null;
  if (tenancyId) {
    await supabase
      .from("tenancies")
      .update({ onboarding_status: "active", status: "active" })
      .eq("id", tenancyId);

    const { sendMoveInInstructionsEmail } = await import("@/lib/onboarding/send-move-in-email");
    await sendMoveInInstructionsEmail(supabase, tenancyId, user.id);
  }

  revalidatePath(`/dashboard/contracts/${contractId}`);
  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/tenancies");
  return { ok: true };
}

export async function signContractAsLandlord(
  contractId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, status, tenant_signed_at, landlord_signed_at, tenancy_id")
    .eq("id", contractId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !contract) {
    return { ok: false, error: "Contract not found" };
  }

  if (contract.landlord_signed_at) {
    return { ok: false, error: "Already signed" };
  }

  const now = new Date().toISOString();
  const bothSigned = Boolean(contract.tenant_signed_at);
  const newStatus = bothSigned ? "signed" : "pending_signature";

  const { error: updateErr } = await supabase
    .from("contracts")
    .update({
      landlord_signed_at: now,
      status: newStatus,
      updated_at: now,
    })
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  const tenancyId = contract.tenancy_id as string | null;
  if (tenancyId) {
    await supabase
      .from("tenancies")
      .update({ onboarding_status: bothSigned ? "signed" : "pending_signature" })
      .eq("id", tenancyId);
  }

  revalidatePath(`/dashboard/contracts/${contractId}`);
  revalidatePath("/dashboard/contracts");
  return { ok: true };
}
