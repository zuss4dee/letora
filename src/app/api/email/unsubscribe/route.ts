import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing unsubscribe token" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: log, error: findError } = await supabase
    .from("email_logs")
    .select("user_id, to_email")
    .eq("unsubscribe_token", token)
    .single();

  if (findError || !log) {
    return NextResponse.json({ error: "Invalid unsubscribe token" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("email_unsubscribes").insert({
    user_id: log.user_id,
    email_address: log.to_email.toLowerCase(),
    unsubscribe_token: token,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ message: "Already unsubscribed" });
    }
    return NextResponse.json({ error: "Failed to process unsubscribe" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";

  return NextResponse.redirect(`${baseUrl}/unsubscribed?email=${encodeURIComponent(log.to_email)}`);
}
