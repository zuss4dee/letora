"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createContractSchema } from "@/lib/validations/contracts";

export type ContractRow = {
  id: string;
  tenantId: string | null;
  tenantFullName: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
};

export async function getContracts(userId: string): Promise<{
  active: ContractRow[];
  drafts: ContractRow[];
}> {
  const supabase = await createClient();

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id,tenant_id,property_id,contract_type,start_date,end_date,status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !contracts) return { active: [], drafts: [] };

  const tenantIds = contracts
    .map((c) => c.tenant_id)
    .filter((id): id is string => Boolean(id));
  const propertyIds = contracts
    .map((c) => c.property_id)
    .filter((id): id is string => Boolean(id));

  const { data: tenants } = await supabase
    .from("tenant_profiles")
    .select("id,full_name")
    .in("id", tenantIds.length ? tenantIds : ["none"]);

  const { data: properties } = await supabase
    .from("properties")
    .select("id,address,city")
    .in("id", propertyIds.length ? propertyIds : ["none"]);

  const rows: ContractRow[] = contracts.map((c) => {
    const tenant = tenants?.find((t) => t.id === c.tenant_id);
    const property = properties?.find((p) => p.id === c.property_id);
    const propertyAddress = property
      ? `${property.address ?? "Unknown"}${property.city ? `, ${property.city}` : ""}`
      : "Unknown";

    return {
      id: c.id,
      tenantId: c.tenant_id ?? null,
      tenantFullName: tenant?.full_name ?? "Unknown",
      propertyId: c.property_id ?? null,
      propertyAddress,
      contractType: c.contract_type ?? null,
      startDate: c.start_date ?? null,
      endDate: c.end_date ?? null,
      status: c.status ?? null,
    };
  });

  const drafts = rows.filter((row) => (row.status ?? "draft") === "draft");
  const active = rows.filter((row) =>
    ["sent", "signed"].includes((row.status ?? "draft").toLowerCase()),
  );

  return { active, drafts };
}

export async function createContract(formData: unknown, status: "draft" | "sent") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = createContractSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  const { error } = await supabase.from("contracts").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    tenant_id: values.tenantId,
    property_id: values.propertyId,
    contract_type: values.contractType,
    start_date: values.startDate,
    end_date: values.endDate,
    monthly_rent: values.monthlyRent,
    deposit_amount: values.depositAmount,
    special_clauses: values.specialClauses?.trim() ? values.specialClauses : null,
    status,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/contracts");
  return { ok: true as const };
}

