# Feeder integration — `POST /api/integrations/v1/tasks`

Minimal contract for external apps delivering structured work into Letora.

## Authentication

Configure `LETORA_FEEDER_SECRET` in the Letora deployment. Each request must prove possession of that secret using **one** of:

1. **Bearer token** — `Authorization: Bearer <LETORA_FEEDER_SECRET>`
2. **HMAC** — header `X-Letora-Signature: sha256=<hex>` where `<hex>` is the lowercase hex digest of **the raw request body** using HMAC-SHA256 and the same secret.

## Idempotency

Include a stable `idempotency_key` (string) per logical event. Retries with the same key return HTTP 200 and the **same** event `id` with `duplicate: true`.

## Request body (JSON)

| Field | Required | Description |
|--------|----------|-------------|
| `source` | yes | Producer id, e.g. `feeder_acme_v1` |
| `type` | yes | Event name, e.g. `tenancy.onboarding.requested` |
| `idempotency_key` | recommended | Unique key for this delivery |
| `occurred_at` | no | ISO 8601 timestamp |
| `tenant_id` | no | UUID |
| `tenancy_id` | no | UUID |
| `payload` | no | Arbitrary JSON object (merged into stored payload) |

## Response

```json
{ "ok": true, "id": "<uuid>", "duplicate": false }
```

## Debugging

With `CRON_SECRET`, list recent stored events:

`GET /api/internal/integration-events`  
Header: `Authorization: Bearer <CRON_SECRET>`

## Processing

Today, events are stored and immediately marked `processed` (routing by `type` is a future iteration). Inspect rows in `public.inbound_integration_events`.
