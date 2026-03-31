# Tool catalog (rent chaser v1)

Tools are invoked by the runtime (TypeScript executors). Names align with `src/lib/agents/tools/rent-chaser-tools.ts` and the in-process MCP registry.

| Tool | Purpose | Idempotent |
|------|---------|------------|
| `list_chaseable_payments` | List overdue / past-due pending rent payments for the user | Yes (read) |
| `draft_chase_email` | Produce subject + body for one payment row | Yes for same inputs |
| `save_agent_run` | Persist a draft payload to `agent_runs` | No (creates row) |
| `send_rent_chase_email` | Send transactional email when **auto-chase** is enabled | No (sends mail) |

Email send must check user settings: if auto-chase is off, `send_rent_chase_email` is a no-op and only drafts are stored.
