import { NextResponse } from "next/server";

import { executeCEOTool } from "@/lib/agents/ceo/executor";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("leadId" in body)) {
    return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  }
  const leadId = typeof (body as { leadId: unknown }).leadId === "string"
    ? (body as { leadId: string }).leadId.trim()
    : "";
  if (!leadId) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ? createServiceRoleClient()
    : await createClient();

  try {
    const raw = await executeCEOTool(
      "qualify_leads",
      { lead_id: leadId },
      user.id,
      supabase,
    );
    return NextResponse.json({ ok: true as const, raw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
