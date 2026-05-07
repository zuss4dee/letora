# Agents runtime (Letora)

## Layout

- **`agents/`** (repo root): Markdown packs per agent — `agents.md`, `skills/*.md`, plus `agents/_shared/` and `agents/skills/` for reuse.
- **`src/lib/agents/registry.ts`**: Which files belong to which agent id.
- **`src/lib/agents/context-loader.ts`**: Loads markdown + optional `user_agent_memory` rows from Supabase.
- **`src/lib/agents/rent-chaser.ts`**: Rent chaser pipeline — Observe (payments) → Think (Gemini draft) → Act (`agent_runs`, then `sendEmailTool` / `email_logs`).
- **`src/lib/agents/tenant-onboarding.ts`**: Tenant onboarding — Observe (tenancy/tenant/property) → Think (load `tenant_onboarding` markdown) → Act (`sendEmailTool` with `agentType: 'onboarding'`, create **`onboarding_tasks`**, set **`tenancies.onboarding_status`** to `in_progress`, **`agent_runs`** summary).
- **`src/lib/agents/maintenance-agent.ts`**: Maintenance / complaints — Observe (maintenance request + property + tenant) → Think (Gemini JSON triage from `maintenance_agent` skills) → Act (update **`maintenance_requests`** `ai_triage_*`, **`sendEmailTool`** ×2 with `agentType: 'maintenance'`, optional **`agent_runs`** row with `agent_type: 'safety_alert'` for **urgent-safety**, timestamps, **`agent_runs`** completion). Max **5** OTA steps; every step logged to **`agent_run_steps`**.
- **`src/lib/agents/audit.ts`**: Writes `agent_run_steps` for each step.
- **`src/lib/agents/mcp-host.ts`**: In-process MCP-style tool catalog (`listRentChaserMcpTools`) for discovery; execution stays in TS.

## Environment

| Variable | Purpose |
|----------|---------|
| `GOOGLE_AI_API_KEY` | Gemini for drafts |
| `RESEND_API_KEY` | Transactional email |
| `RESEND_FROM_EMAIL` | Verified platform sender address (required for auto-send and manual “Send now”) |
| `CRON_SECRET` | Protects `GET /api/cron/rent-chase` |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron user iteration (server-only) |

## User settings

- **`email_from_name`**: Optional display name for the Resend `From` header: `"${email_from_name}" <${RESEND_FROM_EMAIL}>` (falls back to `"Letora"` when empty).
- **Auto-send toggles** (all default `false`): `auto_send_rent_chaser`, `auto_send_maintenance_updates`, `auto_send_onboarding_emails`, `auto_send_lead_updates`. When a toggle is off for an agent type, `sendEmailTool` leaves the row in **`email_logs` as `draft`** so the landlord can review it in **Pending Email Drafts** (not `skipped`). **`skipped`** is reserved for explicit business-rule blocks (e.g. policy guards), not for “auto-send disabled.”

## Email pipeline

- **`src/lib/tools/send-email.ts` — `sendEmailTool`**: Inserts **`email_logs`** (`status: draft`), then sends via Resend only when the matching auto-send toggle is on and env is valid; updates the row to `sent` / `failed` or leaves `draft`.
- **`email_logs`**: Stores `to_email`, `to_name`, `subject`, `body`, `status`, optional `agent_run_id`, `agent_type`, `sent_at`, `error_message`.
- **Rent chaser** (`src/lib/agents/rent-chaser.ts`): After Gemini draft, inserts **`agent_runs`**, then calls **`sendEmailTool`** with `agentType: 'rent_chaser'` and the new run id.
- **Tenant onboarding** (`src/lib/agents/tenant-onboarding.ts`): Welcome email via **`sendEmailTool`** (`agentType: 'onboarding'`); reference-check tasks (due move-in minus 14 days); move-in instructions email task (due move-in minus 3 days); manual tenancy-agreement task. Respects **`auto_send_onboarding_emails`**.
- **Maintenance agent** (`src/lib/agents/maintenance-agent.ts`): Tenant acknowledgement + landlord summary emails only via **`sendEmailTool`** (`agentType: 'maintenance'`). Respects **`auto_send_maintenance_updates`**. Tenant acknowledgement is **always** drafted first (never skipped when auto-send is off). **urgent-safety** triage always inserts an additional **`agent_runs`** row with `agent_type: 'safety_alert'` so the main dashboard can show a **Safety alerts** card (last 7 days) — safety is never silent.

## Auto-trigger (maintenance)

After a successful insert of a **`maintenance_requests`** row, **`addMaintenanceRequest`** (`src/lib/actions/maintenance.ts`) calls **`runMaintenanceAgent(requestId, userId)`** in the background with **`.catch(console.error)`** (fire-and-forget, does not block the UI). The landlord’s session email is passed as **`landlordEmailFallback`** when **`user_settings.contact_email`** is empty so the landlord summary still has a recipient.

## `maintenance_requests` AI columns (Phase 3)

| Column | Notes |
|--------|--------|
| `ai_triage_category` | `urgent-safety` \| `urgent` \| `routine` \| `low-priority` |
| `ai_triage_summary` | One-line AI summary |
| `tenant_acknowledged_at` | Set when tenant acknowledgement email log is created |
| `landlord_notified_at` | Set when landlord summary email log is created |

## `onboarding_tasks` (Supabase)

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `tenancy_id` | FK → `tenancies` |
| `user_id` | FK → `auth.users` (landlord) |
| `task_name` | Human-readable label |
| `task_type` | `email` \| `check` \| `document` \| `manual` |
| `status` | `pending` \| `complete` \| `skipped` |
| `email_log_id` | Optional FK → `email_logs` |
| `due_date` / `completed_at` | Optional |

RLS: users manage rows where `user_id = auth.uid()`.

**`tenancies.onboarding_status`:** `not_started` \| `in_progress` \| `references` \| `contract_sent` \| `complete` (default `not_started`).

## API routes

| Route | Purpose |
|-------|---------|
| `POST /api/agents/onboarding` | Body: `{ tenancyId }`. Session auth. Runs **`runTenantOnboardingAgent`**. Returns `{ success, agentRunId, tasksCreated, emailStatus, message? }`. |
| `POST /api/agents/maintenance` | Body: `{ maintenanceRequestId }`. Session auth. Manual re-run of **`runMaintenanceAgent`**. Returns `{ success, agentRunId?, triageCategory?, tenantEmailStatus?, landlordEmailStatus? }`. |
| `POST /api/webhooks/inbound-email` | Resend/Svix inbound; correlates **`LETORA_REF`** to tenancies. See **[referencing-inbound.md](./referencing-inbound.md)**. |

## Cron

**Vercel (`vercel.json`):**

| Path | Default schedule (UTC) | Purpose |
|------|------------------------|---------|
| `/api/cron/rent-chase` | `0 7 * * *` (daily 07:00) | Runs **`runRentChaserAgent`** for every `user_settings` user (service role). Drafts → **`agent_approvals`** (`send_rent_chase_email`) when chaseable arrears exist. |
| `/api/cron/stale-approval-reminders` | `0 8 * * *` (daily 08:00) | Operator reminders for stale pending approvals. |

Vercel Cron sends **`Authorization: Bearer <CRON_SECRET>`** when **`CRON_SECRET`** is set on the Vercel project.

**Required env for rent-chase cron:** `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`. Missing `GOOGLE_AI_API_KEY` causes **`runRentChaserAgent`** to throw for that user (see function runtime check).

Manual test:

`curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://<deployment>/api/cron/rent-chase"`

## Orchestrator

`src/lib/agents/orchestrator.ts` — keyword routing for future NL entry; v1 rent chaser is invoked directly or via cron/API.
