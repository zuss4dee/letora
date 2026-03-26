import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { status?: "pending" | "paid" | "overdue" };
  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const payload =
    body.status === "paid"
      ? { status: "paid", paid_date: new Date().toISOString().slice(0, 10) }
      : { status: body.status, paid_date: null };

  const { error } = await supabase
    .from("rent_payments")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

