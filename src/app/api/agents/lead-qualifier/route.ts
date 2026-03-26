import { NextResponse } from "next/server";

import { runLeadQualifierAgent } from "@/lib/agents/lead-qualifier";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runLeadQualifierAgent(user.id);
  return NextResponse.json({ results });
}

