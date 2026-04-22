// Supabase Edge Function: verifies service-role caller, then forwards to Next.js internal route.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically in every Edge Function.

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && "SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    return new Response(`Missing ${missing.join(", ")}`, { status: 501 });
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    tenancy_id?: string;
    tenant_id?: string;
    property_id?: string;
    landlord_id?: string;
    rent_amount?: unknown;
    move_in_date?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const baseUrl = (Deno.env.get("NEXT_PUBLIC_APP_URL") ?? Deno.env.get("APP_URL") ?? "").replace(
    /\/+$/,
    "",
  );
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!baseUrl || !cronSecret) {
    return new Response("Missing NEXT_PUBLIC_APP_URL (or APP_URL) or CRON_SECRET", { status: 501 });
  }

  console.log("edge cron prefix", cronSecret.slice(0, 12), "len", cronSecret.length);

  const res = await fetch(`${baseUrl}/api/internal/auto-onboard-tenant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenancy_id: body.tenancy_id,
      tenant_id: body.tenant_id,
      property_id: body.property_id,
      landlord_id: body.landlord_id,
      rent_amount: body.rent_amount,
      move_in_date: body.move_in_date,
    }),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
    },
  });
});
