import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, contract_type, tenant_id, property_id")
      .eq("user_id", user.id)
      .eq("status", "draft");

    if (!contracts || contracts.length === 0) return NextResponse.json({ contracts: [] });

    const tenantIds = contracts.map((c) => c.tenant_id).filter(Boolean);
    const propertyIds = contracts.map((c) => c.property_id).filter(Boolean);

    const { data: tenants } = await supabase
      .from("tenant_profiles")
      .select("id, full_name")
      .in("id", tenantIds.length ? tenantIds : ["none"]);

    const { data: properties } = await supabase
      .from("properties")
      .select("id, address, city")
      .in("id", propertyIds.length ? propertyIds : ["none"]);

    const enriched = contracts.map((c) => ({
      id: c.id,
      contract_type: c.contract_type,
      tenant_name: tenants?.find((t) => t.id === c.tenant_id)?.full_name ?? "Unknown Tenant",
      property_address: (() => {
        const p = properties?.find((p) => p.id === c.property_id);
        return p ? `${p.address}, ${p.city}` : "Unknown Property";
      })(),
    }));

    return NextResponse.json({ contracts: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}

