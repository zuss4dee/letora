import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "Missing signing token" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, status, tenant_id, property_id, tenancy_id, tenant_signed_at, landlord_signed_at, user_id")
    .eq("signing_token", token)
    .single();

  if (fetchErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.tenant_signed_at) {
    return NextResponse.json({ error: "You have already signed this contract" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const bothSigned = Boolean(contract.landlord_signed_at);
  const newStatus = bothSigned ? "signed" : "pending_signature";

  await supabase
    .from("contracts")
    .update({
      tenant_signed_at: now,
      status: newStatus,
      updated_at: now,
    })
    .eq("id", contract.id);

  if (contract.tenancy_id) {
    await supabase
      .from("tenancies")
      .update({ onboarding_status: bothSigned ? "signed" : "pending_signature" })
      .eq("id", contract.tenancy_id);
  }

  if (bothSigned) {
    const { data: landlord } = await supabase
      .from("auth.users" as "contracts")
      .select("email")
      .eq("id", contract.user_id)
      .single();

    const landlordEmail = (landlord as { email?: string } | null)?.email;

    if (landlordEmail) {
      const { data: property } = await supabase
        .from("properties")
        .select("address, city")
        .eq("id", contract.property_id)
        .single();

      const addr = [property?.address, property?.city].filter(Boolean).join(", ") || "your property";
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

      if (apiKey && fromEmail) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: `Letora <${fromEmail}>`,
          to: landlordEmail,
          subject: "Contract fully signed",
          text: `Both parties have signed the contract for ${addr}. You can now confirm move-in to set the tenancy to active.`,
        });
      }
    }
  } else {
    const { data: landlordProfile } = await supabase
      .from("user_settings")
      .select("email_from_name")
      .eq("user_id", contract.user_id)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("full_name")
      .eq("id", contract.tenant_id)
      .single();

    const { data: property } = await supabase
      .from("properties")
      .select("address, city")
      .eq("id", contract.property_id)
      .single();

    void landlordProfile;

    const tenantName = tenant?.full_name?.trim() || "Your tenant";
    const addr = [property?.address, property?.city].filter(Boolean).join(", ") || "your property";

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

    if (apiKey && fromEmail) {
      const { data: userRow } = await supabase.rpc("get_user_email", { uid: contract.user_id });
      const landlordEmail = typeof userRow === "string" ? userRow : null;

      if (landlordEmail) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: `Letora <${fromEmail}>`,
          to: landlordEmail,
          subject: `${tenantName} has signed the contract for ${addr}`,
          text: `${tenantName} has signed the tenancy agreement for ${addr}. Please sign as landlord in your Letora dashboard to complete the contract.`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
