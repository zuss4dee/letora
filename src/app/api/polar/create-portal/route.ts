import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Polar.sh Portal Redirection
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = process.env.POLAR_ORGANIZATION_ID;
    if (!orgId) {
      return NextResponse.json({ error: "Polar Organization ID not configured" }, { status: 500 });
    }

    // Polar currently uses a fixed portal URL per organization for authenticated customers.
    // In the future, this may return a per-session URL if Polar adds it.
    const url = `https://polar.sh/${orgId}/portal`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Polar Portal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
