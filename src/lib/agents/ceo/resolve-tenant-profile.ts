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
 * Resolve tenant id from a tool argument: exact UUID first, then a single
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

  if (looksLikeUuid(t)) {
    const { data: byId, error: idErr } = await supabase
      .from("tenants")
      .select("id, full_name")
      .eq("id", t)
      .eq("user_id", userId)
      .maybeSingle();

    if (idErr) {
      return { ok: false, body: { error: `Could not load tenant: ${idErr.message}` } };
    }
    if (byId) {
      console.log("[tenant lookup] table: tenants, query:", t, "result count:", 1);
      return { ok: true, tenantId: byId.id, full_name: byId.full_name, resolved_via: "id" };
    }

    console.log("[tenant lookup] table: tenants, query:", t, "result count:", 0);
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

  const words = fragment.split(/\s+/).filter((w) => w.length >= 2);

  let { data, error: nameErr } = await supabase
    .from("tenants")
    .select("id, full_name")
    .eq("user_id", userId)
    .ilike("full_name", `%${fragment}%`)
    .limit(8);

  console.log("[tenant lookup] table: tenants, query:", t, "result count:", data?.length);

  /** If the full phrase is missing (e.g. extra punctuation in DB) but each word matches one profile. */
  if ((!data?.length) && words.length >= 2) {
    let q = supabase.from("tenants").select("id, full_name").eq("user_id", userId);
    for (const w of words) {
      q = q.ilike("full_name", `%${w}%`);
    }
    const second = await q.limit(8);
    data = second.data;
    if (second.error) {
      nameErr = second.error;
    }
    if (data?.length) {
      console.log("[tenant lookup] table: tenants, query:", t, "result count (word match):", data.length);
    }
  }

  if (nameErr) {
    return { ok: false, body: { error: `Could not search tenants: ${nameErr.message}` } };
  }
  if (!data?.length) {
    return {
      ok: false,
      body: {
        code: "tenant_not_found_by_name",
        error: "No tenant profile matched that name on this account.",
        hint: "Ready to continue once you confirm the tenant full name (or share the tenant UUID if you already have it).",
      },
    };
  }
  if (data.length > 1) {
    return {
      ok: false,
      body: {
        code: "tenant_name_ambiguous",
        error: "More than one tenant matches that name.",
        hint: "Confirm which tenant you mean and I will continue.",
        candidates: data.map((r) => ({ id: r.id, full_name: r.full_name })),
      },
    };
  }

  return {
    ok: true,
    tenantId: data[0].id,
    full_name: data[0].full_name,
    resolved_via: "name",
  };
}
