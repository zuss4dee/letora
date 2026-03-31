# Agents runtime (Letora)

## Layout

- **`agents/`** (repo root): Markdown packs per agent — `agents.md`, `skills/*.md`, plus `agents/_shared/` and `agents/skills/` for reuse.
- **`src/lib/agents/registry.ts`**: Which files belong to which agent id.
- **`src/lib/agents/context-loader.ts`**: Loads markdown + optional `user_agent_memory` rows from Supabase.
- **`src/lib/agents/rent-chaser.ts`**: Rent chaser pipeline — Observe (payments) → Think (Gemini draft) → Act (`agent_runs`, then `sendEmailTool` / `email_logs`).
- **`src/lib/agents/tenant-onboarding.ts`**: Tenant onboarding — Observe (tenancy/tenant/property) → Think (load `tenant_onboarding` markdown) → Act (`sendEmailTool` with `agentType: 'onboarding'`, create **`onboarding_tasks`**, set **`tenancies.onboarding_status`** to `in_progress`, **`agent_runs`** summary).
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

## Cron

Configure your host (e.g. Vercel Cron) to `GET /api/cron/rent-chase` with header `Authorization: Bearer $CRON_SECRET` daily or as needed.

## Orchestrator

`src/lib/agents/orchestrator.ts` — keyword routing for future NL entry; v1 rent chaser is invoked directly or via cron/API.
