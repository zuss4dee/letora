-- Dashboard / Command Center hot-path indexes.
-- Matches query shapes in:
--   command-center-queries.ts (KPI burst, arrears/maintenance queues, financials helpers)
--   dashboard.ts (`getDashboardStats`)
--   safety-alerts.ts (`getSafetyAlertsLast7Days`)
--
-- Explicitly unchanged by this migration (already present):
--   agent_activity_user_created_idx  — getRecentActivity(user_id ORDER BY created_at DESC)
--   agent_approvals_user_status_created_idx — pending lists + counts
--   user_settings UNIQUE (user_id) — shell slice SELECT ... WHERE user_id = $1 ? maybeSingle()

-- -----------------------------------------------------------------------------
-- agent_runs
-- -----------------------------------------------------------------------------

-- activeAgentCount(): WHERE user_id = ? AND status IN ('running','queued') (count/exact head)
CREATE INDEX IF NOT EXISTS agent_runs_user_status_created_idx
  ON public.agent_runs (user_id, status);

-- getSafetyAlertsLast7Days(): WHERE user_id = ? AND agent_type = 'safety_alert'
--   AND created_at >= ? ORDER BY created_at DESC LIMIT n
CREATE INDEX IF NOT EXISTS agent_runs_user_agent_type_created_idx
  ON public.agent_runs (user_id, agent_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- maintenance_requests
-- -----------------------------------------------------------------------------

-- getDashboardStats / command-center queues: join via tenancy_id, filter status IN (...)
CREATE INDEX IF NOT EXISTS maintenance_requests_tenancy_status_idx
  ON public.maintenance_requests (tenancy_id, status);

-- -----------------------------------------------------------------------------
-- rent_payments
-- -----------------------------------------------------------------------------

-- loadCommandCenterFinancials + queue patterns: filter/join by tenancy_id, range on due_date
CREATE INDEX IF NOT EXISTS rent_payments_tenancy_due_date_idx
  ON public.rent_payments (tenancy_id, due_date);

-- Second branch of loadCommandCenterFinancials: paid_date NOT NULL + range on paid_date
CREATE INDEX IF NOT EXISTS rent_payments_tenancy_paid_date_partial_idx
  ON public.rent_payments (tenancy_id, paid_date)
  WHERE paid_date IS NOT NULL;
