-- One pending agent_run per landlord + tenant email + rent instalment (rent_chaser dedupe).
-- instalmentId is always set by rent-chaser.ts for new rows (rent_payments.id). Rows with a
-- missing instalmentId are excluded from the index: in PostgreSQL, NULL index entries do not
-- participate in UNIQUE the same way as distinct values, so we require NOT NULL for a reliable constraint.
-- agent_type is scoped to rent_chaser so other agents' pending payloads cannot collide on email/instalment keys.

CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_pending_tenant_instalment_unique
ON public.agent_runs (
  user_id,
  (lower(trim(coalesce(payload->>'tenantEmail', '')))),
  (payload->>'instalmentId')
)
WHERE status = 'pending'
  AND agent_type = 'rent_chaser'
  AND (payload->>'instalmentId') IS NOT NULL;
