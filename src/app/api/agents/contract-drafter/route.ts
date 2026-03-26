import { NextResponse } from "next/server";

import { runContractDrafterAgent } from "@/lib/agents/contract-drafter";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { contractId } = (await req.json()) as { contractId?: string };
    if (!contractId) {
      return NextResponse.json({ error: "contractId required" }, { status: 400 });
    }

    const result = await runContractDrafterAgent(contractId, user.id);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Contract drafter error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

