import { NextResponse } from "next/server";

import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runRentChaserAgent(user.id);
  return NextResponse.json({ results });
}

