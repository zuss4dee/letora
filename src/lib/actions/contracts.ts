"use server";

import { revalidatePath } from "next/cache";

import { addContractSchema } from "@/lib/validations/contracts";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";

export type ContractListRow = {
  id: string;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number;
  depositAmount: number;
  specialClauses: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  propertyAddress: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
};

export type ContractTemplateRow = {
  id: string;
  filename: string;
  storage_path: string;
  is_default: boolean;
  created_at: string | null;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getContracts(): Promise<ContractListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getContracts]", error.message);
    return [];
  }

  const rows = contracts ?? [];
  const propertyIds = [
    ...new Set(rows.map((c) => c.property_id).filter((id): id is string => Boolean(id))),
  ];
  const tenantIds = [
    ...new Set(rows.map((c) => c.tenant_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: properties }, { data: tenants }] = await Promise.all([
    propertyIds.length > 0
      ? supabase.from("properties").select("id, address").in("id", propertyIds)
      : Promise.resolve({ data: [] as { id: string; address: string | null }[] | null }),
    tenantIds.length > 0
      ? supabase.from("tenants").select("id, full_name, email").in("id", tenantIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string | null;
            email: string | null;
          }[] | null,
        }),
  ]);

  const propById = new Map((properties ?? []).map((p) => [p.id, p] as const));
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t] as const));

  return rows.map((c) => {
    const prop = c.property_id ? propById.get(c.property_id) : undefined;
    const ten = c.tenant_id ? tenantById.get(c.tenant_id) : undefined;
    const addr = prop?.address ?? "";
    return {
      id: c.id as string,
      contractType: (c.contract_type as string | null) ?? null,
      startDate: (c.start_date as string | null) ?? null,
      endDate: (c.end_date as string | null) ?? null,
      monthlyRent: toNum(c.monthly_rent),
      depositAmount: toNum(c.deposit_amount),
      specialClauses: (c.special_clauses as string | null) ?? null,
      status: (c.status as string | null) ?? null,
      createdAt: (c.created_at as string | null) ?? null,
      updatedAt: (c.updated_at as string | null) ?? null,
      propertyAddress: normalizePropertyAddressLabel(addr) || null,
      tenantName: ten?.full_name ?? null,
      tenantEmail: ten?.email ?? null,
    };
  });
}

export async function getContractDetail(contractId: string): Promise<ContractListRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: c, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !c) return null;

  const [{ data: property }, { data: tenant }] = await Promise.all([
    c.property_id
      ? supabase.from("properties").select("address").eq("id", c.property_id).maybeSingle()
      : Promise.resolve({ data: null as { address: string | null } | null }),
    c.tenant_id
      ? supabase
          .from("tenants")
          .select("full_name, email")
          .eq("id", c.tenant_id)
          .maybeSingle()
      : Promise.resolve({
          data: null as {
            full_name: string | null;
            email: string | null;
          } | null,
        }),
  ]);

  const addr = property?.address ?? "";
  return {
    id: c.id as string,
    contractType: (c.contract_type as string | null) ?? null,
    startDate: (c.start_date as string | null) ?? null,
    endDate: (c.end_date as string | null) ?? null,
    monthlyRent: toNum(c.monthly_rent),
    depositAmount: toNum(c.deposit_amount),
    specialClauses: (c.special_clauses as string | null) ?? null,
    status: (c.status as string | null) ?? null,
    createdAt: (c.created_at as string | null) ?? null,
    updatedAt: (c.updated_at as string | null) ?? null,
    propertyAddress: normalizePropertyAddressLabel(addr) || null,
    tenantName: tenant?.full_name ?? null,
    tenantEmail: tenant?.email ?? null,
  };
}

export async function addContract(data: {
  tenantId: string;
  propertyId: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  specialClauses?: string;
}): Promise<void> {
  const parsed = addContractSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid contract data");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("user_id")
    .eq("id", parsed.data.propertyId)
    .maybeSingle();

  if (propErr || !property) {
    throw new Error("Property not found");
  }
  if (property.user_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const { data: tenant, error: tenErr } = await supabase
    .from("tenants")
    .select("user_id")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();

  if (tenErr || !tenant) {
    throw new Error("Tenant not found");
  }
  if (tenant.user_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("contracts").insert({
    user_id: user.id,
    tenant_id: parsed.data.tenantId,
    property_id: parsed.data.propertyId,
    contract_type: parsed.data.contractType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    monthly_rent: parsed.data.monthlyRent,
    deposit_amount: parsed.data.depositAmount,
    special_clauses: parsed.data.specialClauses?.trim() ? parsed.data.specialClauses.trim() : null,
    status: "draft",
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard");
}

export type ContractStatusUpdate = "draft" | "active" | "expired" | "terminated";

export async function updateContractStatus(
  contractId: string,
  status: ContractStatusUpdate,
): Promise<void> {
  const allowed: ContractStatusUpdate[] = ["draft", "active", "expired", "terminated"];
  if (!allowed.includes(status)) {
    throw new Error("Invalid status");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("contracts")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/contracts");
  revalidatePath(`/dashboard/contracts/${contractId}`);
}

export async function deleteContract(contractId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/contracts");
}

export async function getContractTemplates(): Promise<ContractTemplateRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("contract_templates")
    .select("id,filename,storage_path,is_default,created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getContractTemplates]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    filename: row.filename as string,
    storage_path: row.storage_path as string,
    is_default: Boolean(row.is_default),
    created_at: (row.created_at as string | null) ?? null,
  }));
}
