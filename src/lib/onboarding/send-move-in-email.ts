import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailTool } from "@/lib/tools/send-email";

type MoveInEmailResult = {
  sent: boolean;
  emailLogId: string;
  message: string;
  error?: string;
};

export async function sendMoveInInstructionsEmail(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  agentRunId: string | null = null,
): Promise<MoveInEmailResult> {
  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      start_date,
      move_in_date,
      monthly_rent,
      deposit_amount,
      properties!inner ( address, city, postcode ),
      tenants ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .eq("properties.user_id", userId)
    .maybeSingle();

  if (tenErr || !tenancy) {
    return { sent: false, emailLogId: "", message: "Tenancy not found", error: "Tenancy not found" };
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
    return { sent: false, emailLogId: "", message: "Tenant has no email", error: "Missing tenant email" };
  }

  const addressLabel = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");
  const moveInDate = tenancy.move_in_date ?? tenancy.start_date;

  const formattedDate = moveInDate
    ? new Date(`${moveInDate}T12:00:00.000Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "TBC";

  const subject = `Move-in instructions — ${addressLabel || "your new home"}`;
  const body = [
    `Dear ${tenant.full_name ?? "Tenant"},`,
    "",
    `Welcome to ${addressLabel || "your new home"}! Your move-in date is confirmed for ${formattedDate}.`,
    "",
    "Here are some important details to help you settle in:",
    "",
    "Keys",
    "Your keys will be available for collection on your move-in date. We'll confirm the collection point closer to the time.",
    "",
    "Utilities",
    "Please ensure you've arranged gas, electricity, water, and broadband connections. Your landlord can provide meter locations if needed.",
    "",
    "Council Tax",
    "You'll need to register for council tax with your local authority. This is the tenant's responsibility.",
    "",
    "Rent Payments",
    `Monthly rent: £${Number(tenancy.monthly_rent).toFixed(2)}`,
    "Rent is due on the same date each month. You'll receive payment reminders and receipts via email.",
    "",
    tenancy.deposit_amount
      ? `Deposit: £${Number(tenancy.deposit_amount).toFixed(2)} — Your deposit will be protected in a government-approved scheme and you'll receive the protection certificate separately.`
      : "",
    "",
    "Maintenance",
    "If you need to report a maintenance issue, you can do so through your Letora dashboard or by replying to this email.",
    "",
    "Emergency Contact",
    "For urgent maintenance issues (e.g. burst pipes, gas leaks), reply to this email marked URGENT and we'll prioritise your request.",
    "",
    "We hope you enjoy your new home. If you have any questions, don't hesitate to reach out.",
    "",
    "Kind regards,",
    "Letora Property Management",
  ].filter(Boolean).join("\n");

  const emailResult = await sendEmailTool(supabase, userId, agentRunId, {
    to: tenant.email,
    toName: tenant.full_name ?? "",
    subject,
    body,
    agentType: "onboarding",
    forceSend: true,
  });

  if (emailResult.sent) {
    await supabase
      .from("onboarding_tasks")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        email_log_id: emailResult.emailLogId,
      })
      .eq("tenancy_id", tenancyId)
      .eq("user_id", userId)
      .eq("task_name", "Send move-in instructions email")
      .eq("status", "pending");
  }

  return emailResult;
}
