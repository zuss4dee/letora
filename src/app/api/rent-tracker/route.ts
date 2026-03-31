import { NextRequest, NextResponse } from "next/server";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  amount: number | string | null;
  due_date: string | null;
  paid_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: payments, error } = await supabase
    .from("rent_payments")
    .select("id,property_id,tenant_id,amount,due_date,paid_date,status,notes,created_at")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (payments ?? []) as PaymentRow[];
  const propertyIds = rows.map((p) => p.property_id).filter((id): id is string => Boolean(id));
  const tenantIds = rows.map((p) => p.tenant_id).filter((id): id is string => Boolean(id));

  const [{ data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,address")
      .in("id", propertyIds.length ? propertyIds : ["none"]),
    supabase
      .from("tenant_profiles")
      .select("id,full_name,email")
      .in("id", tenantIds.length ? tenantIds : ["none"]),
  ]);

  const result = rows.map((p) => {
    const property = properties?.find((pr) => pr.id === p.property_id);
    const tenant = tenants?.find((t) => t.id === p.tenant_id);
    const address = normalizePropertyAddressLabel(property?.address ?? "") || "Unknown property";

    return {
      id: p.id,
      propertyId: p.property_id,
      propertyName: address,
      tenantId: p.tenant_id,
      tenantName: tenant?.full_name ?? "Unknown tenant",
      tenantEmail: tenant?.email ?? null,
      amount: toNumber(p.amount),
      dueDate: p.due_date,
      paidDate: p.paid_date,
      status: (p.status ?? "pending").toLowerCase(),
      notes: p.notes ?? null,
      createdAt: p.created_at,
    };
  });

  return NextResponse.json({ payments: result });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    propertyId?: string;
    tenantId?: string | null;
    amount?: number;
    dueDate?: string;
    notes?: string;
  };

  if (!body.propertyId || !body.amount || !body.dueDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rent_payments")
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      property_id: body.propertyId,
      tenant_id: body.tenantId ?? null,
      amount: body.amount,
      due_date: body.dueDate,
      paid_date: null,
      status: "pending",
      notes: body.notes?.trim() ? body.notes : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

