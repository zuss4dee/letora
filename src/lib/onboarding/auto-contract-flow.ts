import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import { sendEmailTool } from "@/lib/tools/send-email";
import { generateContractPdf } from "./generate-contract-pdf";

type AutoContractResult = {
  ok: boolean;
  contractId?: string;
  message: string;
  error?: string;
};

export async function autoCreateAndSendContract(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
): Promise<AutoContractResult> {
  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      start_date,
      end_date,
      monthly_rent,
      deposit_amount,
      move_in_date,
      properties!inner ( address, city, postcode ),
      tenants ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .eq("properties.user_id", userId)
    .maybeSingle();

  if (tenErr || !tenancy) {
    return { ok: false, message: "Tenancy not found", error: "Tenancy not found" };
  }

  const prop = tenancy.properties as unknown as {
    address: string | null;
    city: string | null;
    postcode: string | null;
  };

  const tenantRaw = tenancy.tenants as unknown as
    | { full_name: string | null; email: string | null; phone: string | null }
    | { full_name: string | null; email: string | null; phone: string | null }[]
    | null;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;

  if (!tenant?.email) {
    return { ok: false, message: "Tenant has no email address", error: "Missing tenant email" };
  }

  const signingToken = randomUUID();
  const addressLabel = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");

  const { data: contract, error: insertErr } = await supabase
    .from("contracts")
    .insert({
      user_id: userId,
      tenant_id: tenant.full_name ?? null,
      property_id: null,
      tenancy_id: tenancyId,
      contract_type: "ast",
      start_date: tenancy.start_date,
      end_date: tenancy.end_date,
      monthly_rent: tenancy.monthly_rent,
      deposit_amount: tenancy.deposit_amount,
      signing_token: signingToken,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !contract) {
    return { ok: false, message: insertErr?.message ?? "Failed to create contract", error: insertErr?.message ?? "Failed to create contract" };
  }

  const contractId = contract.id as string;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";
  const signUrl = `${baseUrl}/sign/${signingToken}`;

  const rendered = await import("@/components/email/templates/registry").then((m) =>
    m.renderContractReadyEmail({
      tenantName: tenant.full_name ?? "Tenant",
      propertyAddress: addressLabel || "the property",
      contractUrl: signUrl,
    }),
  );

  const emailResult = await sendEmailTool(supabase, userId, null, {
    to: tenant.email,
    toName: tenant.full_name ?? "",
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
    agentType: "onboarding",
    forceSend: true,
    templateType: "contract_ready",
  });

  if (!emailResult.sent) {
    return {
      ok: true,
      contractId,
      message: `Contract created but email not sent: ${emailResult.message}`,
    };
  }

  await supabase
    .from("tenancies")
    .update({ onboarding_status: "contract_sent" })
    .eq("id", tenancyId);

  await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Prepare tenancy agreement")
    .eq("status", "pending");

  return {
    ok: true,
    contractId,
    message: "Contract created and sent to tenant",
  };
}

export async function autoCreateAndSendContractWithPdf(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  contractText: string,
): Promise<AutoContractResult & { documentUrl?: string }> {
  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      start_date,
      end_date,
      monthly_rent,
      deposit_amount,
      move_in_date,
      properties!inner ( address, city, postcode, user_id ),
      tenants ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .eq("properties.user_id", userId)
    .maybeSingle();

  if (tenErr || !tenancy) {
    return { ok: false, message: "Tenancy not found", error: "Tenancy not found" };
  }

  const prop = tenancy.properties as unknown as {
    address: string | null;
    city: string | null;
    postcode: string | null;
  };

  const tenantRaw = tenancy.tenants as unknown as
    | { full_name: string | null; email: string | null; phone: string | null }
    | { full_name: string | null; email: string | null; phone: string | null }[]
    | null;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;

  if (!tenant?.email) {
    return { ok: false, message: "Tenant has no email address", error: "Missing tenant email" };
  }

  const signingToken = randomUUID();
  const addressLabel = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");

  const { data: contract, error: insertErr } = await supabase
    .from("contracts")
    .insert({
      user_id: userId,
      tenant_id: tenant.full_name ?? null,
      property_id: null,
      tenancy_id: tenancyId,
      contract_type: "ast",
      start_date: tenancy.start_date,
      end_date: tenancy.end_date,
      monthly_rent: tenancy.monthly_rent,
      deposit_amount: tenancy.deposit_amount,
      signing_token: signingToken,
      status: "sent",
      sent_at: new Date().toISOString(),
      special_clauses: contractText,
    })
    .select("id")
    .single();

  if (insertErr || !contract) {
    return { ok: false, message: insertErr?.message ?? "Failed to create contract", error: insertErr?.message ?? "Failed to create contract" };
  }

  const contractId = contract.id as string;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("business_name, landlord_name")
    .eq("user_id", userId)
    .maybeSingle();

  const landlordName =
    (settings?.business_name as string | null)?.trim() ||
    (settings?.landlord_name as string | null)?.trim() ||
    "Letora Property Management";

  const pdfResult = await generateContractPdf(supabase, userId, contractId, {
    tenantName: tenant.full_name ?? "Tenant",
    propertyAddress: addressLabel || "the property",
    contractType: "Assured Shorthold Tenancy",
    startDate: tenancy.start_date,
    endDate: tenancy.end_date,
    monthlyRent: Number(tenancy.monthly_rent) || 0,
    depositAmount: Number(tenancy.deposit_amount) || 0,
    contractText,
    landlordName,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";
  const signUrl = `${baseUrl}/sign/${signingToken}`;

  const rendered = await import("@/components/email/templates/registry").then((m) =>
    m.renderContractReadyEmail({
      tenantName: tenant.full_name ?? "Tenant",
      propertyAddress: addressLabel || "the property",
      contractUrl: signUrl,
    }),
  );

  const emailResult = await sendEmailTool(supabase, userId, null, {
    to: tenant.email,
    toName: tenant.full_name ?? "",
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
    agentType: "onboarding",
    forceSend: true,
    templateType: "contract_ready",
  });

  if (!emailResult.sent) {
    return {
      ok: true,
      contractId,
      message: `Contract created but email not sent: ${emailResult.message}`,
      documentUrl: pdfResult.ok ? pdfResult.documentUrl : undefined,
    };
  }

  await supabase
    .from("tenancies")
    .update({ onboarding_status: "contract_sent" })
    .eq("id", tenancyId);

  await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Prepare tenancy agreement")
    .eq("status", "pending");

  return {
    ok: true,
    contractId,
    message: "Contract created and sent to tenant",
    documentUrl: pdfResult.ok ? pdfResult.documentUrl : undefined,
  };
}
