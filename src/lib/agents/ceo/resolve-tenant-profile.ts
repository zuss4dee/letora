import type { SupabaseClient } from "@supabase/supabase-js";

/** RFC 4122-style UUID (models sometimes pass display names instead). */
export function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

export function sanitizeIlikeNameFragment(s: string): string {
  return s.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

export type ResolveTenantResult =
  | { ok: true; tenantId: string; full_name: string | null; resolved_via: "id" | "name" }
  | { ok: false; body: Record<string, unknown> };

/**
 * Resolve tenant profile id from a tool argument: exact UUID first, then a single
 * ilike match on full_name (same idea as draft_contract).
 */
export async function resolveTenantProfileForAccount(
  supabase: SupabaseClient,
  userId: string,
  raw: string,
): Promise<ResolveTenantResult> {
  const t = raw.trim();
  if (!t) {
    return { ok: false, body: { error: "tenant_id is empty." } };
  }

  const { data: byId, error: idErr } = await supabase
    .from("tenant_profiles")
    .select("id, full_name")
    .eq("id", t)
    .eq("user_id", userId)
    .maybeSingle();

  if (idErr) {
    return { ok: false, body: { error: `Could not load tenant: ${idErr.message}` } };
  }
  if (byId) {
    return { ok: true, tenantId: byId.id, full_name: byId.full_name, resolved_via: "id" };
  }

  if (looksLikeUuid(t)) {
    return {
      ok: false,
      body: {
        error:
          "Tenant not found for this account — that UUID does not match any tenant profile. Call list_tenants and copy the exact id (not tenancy or property id).",
        hint: "Use the id field from list_tenants output.",
      },
    };
  }

  const fragment = sanitizeIlikeNameFragment(t);
  if (!fragment) {
    return {
      ok: false,
      body: {
        error:
          "Tenant not found for this account. Pass tenant_id from list_tenants (UUID) or a distinctive full name.",
      },
    };
  }

  const { data: rows, error: nameErr } = await supabase
    .from("tenant_profiles")
    .select("id, full_name")
    .eq("user_id", userId)
    .ilike("full_name", `%${fragment}%`)
    .limit(8);

  if (nameErr) {
    return { ok: false, body: { error: `Could not search tenants: ${nameErr.message}` } };
  }
  if (!rows?.length) {
    return {
      ok: false,
      body: {
        error:
          "Tenant not found for this account. Call list_tenants and use the exact id (UUID) from the tenant row.",
        hint: "If you used a name, no profile matched — check spelling or use the UUID from /dashboard/tenants.",
      },
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      body: {
        error:
          "Multiple tenants matched that name — pass the exact tenant_id UUID from list_tenants.",
        candidates: rows.map((r) => ({ id: r.id, full_name: r.full_name })),
      },
    };
  }

  return {
    ok: true,
    tenantId: rows[0].id,
    full_name: rows[0].full_name,
    resolved_via: "name",
  };
}
