import { createHmac, timingSafeEqual } from "crypto";

import {
  processInboundIntegrationEvent,
  recordInboundIntegrationEvent,
} from "@/lib/integrations/inbound-events";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyHmacSha256Hex(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.trim() || !secret) return false;
  const normalized = signatureHeader.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqualHex(expected, normalized);
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed) return null;
  const m = /^Bearer\s+(.+)$/i.exec(trimmed);
  return m?.[1]?.trim() ?? trimmed;
}

/**
 * Feeder ingress: verifies `LETORA_FEEDER_SECRET` via Bearer **or** `X-Letora-Signature: sha256=<hex>` over the raw body.
 */
export async function POST(request: Request) {
  const secret = process.env.LETORA_FEEDER_SECRET?.trim();
  if (!secret) {
    return Response.json({ ok: false, error: "LETORA_FEEDER_SECRET not configured" }, { status: 501 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-letora-signature");
  const bearer = bearerToken(request);

  const hmacOk = verifyHmacSha256Hex(rawBody, sig, secret);
  const bearerOk = bearer === secret;

  if (!hmacOk && !bearerOk) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!source || !type) {
    return Response.json({ ok: false, error: "source and type are required" }, { status: 400 });
  }

  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : null;
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
  const tenancyId = typeof body.tenancy_id === "string" ? body.tenancy_id : null;
  const occurredAt = typeof body.occurred_at === "string" ? body.occurred_at : null;
  const nestedPayload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  const recordPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    tenancy_id: tenancyId,
    occurred_at: occurredAt,
    ...nestedPayload,
  };

  const supabase = createServiceRoleClient();
  const recorded = await recordInboundIntegrationEvent(supabase, {
    source,
    type,
    idempotencyKey,
    payload: recordPayload,
  });

  if (recorded.ok === false) {
    return Response.json({ ok: false, error: recorded.error }, { status: 500 });
  }

  const processed = await processInboundIntegrationEvent(supabase, recorded.id);
  if (processed.ok === false) {
    return Response.json({ ok: false, error: processed.error }, { status: 500 });
  }

  return Response.json({
    ok: true,
    id: recorded.id,
    duplicate: recorded.duplicate,
  });
}
