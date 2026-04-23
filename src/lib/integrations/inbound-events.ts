import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type InboundIntegrationEventStatus = "received" | "processed" | "failed" | "ignored";

export type RecordInboundIntegrationEventInput = {
  userId?: string | null;
  source: string;
  type: string;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
};

export type RecordInboundIntegrationEventResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; error: string };

function isUniqueViolation(err: PostgrestError): boolean {
  return err.code === "23505";
}

/**
 * Insert a received inbound event. Duplicate `idempotency_key` returns the existing row id.
 */
export async function recordInboundIntegrationEvent(
  supabase: SupabaseClient,
  input: RecordInboundIntegrationEventInput,
): Promise<RecordInboundIntegrationEventResult> {
  const idempotencyKey =
    typeof input.idempotencyKey === "string" && input.idempotencyKey.trim() !== ""
      ? input.idempotencyKey.trim()
      : null;

  const row = {
    user_id: input.userId ?? null,
    source: input.source.trim(),
    type: input.type.trim(),
    idempotency_key: idempotencyKey,
    payload: input.payload,
    status: "received" as const,
  };

  const { data, error } = await supabase
    .from("inbound_integration_events")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error) && idempotencyKey) {
      const { data: existing, error: fetchErr } = await supabase
        .from("inbound_integration_events")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (fetchErr || !existing?.id) {
        return { ok: false, error: fetchErr?.message ?? "Idempotent replay failed" };
      }
      return { ok: true, id: existing.id as string, duplicate: true };
    }
    return { ok: false, error: error.message };
  }

  if (!data?.id) {
    return { ok: false, error: "Insert returned no id" };
  }
  return { ok: true, id: data.id as string, duplicate: false };
}

/**
 * MVP processor: marks the row processed. Route `type` → domain handlers in a later iteration.
 */
export async function processInboundIntegrationEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("inbound_integration_events")
    .select("id,status")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Event not found" };
  }

  if (data.status === "processed") {
    return { ok: true };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("inbound_integration_events")
    .update({ status: "processed", processed_at: now, error_message: null })
    .eq("id", eventId)
    .in("status", ["received", "failed"]);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true };
}
