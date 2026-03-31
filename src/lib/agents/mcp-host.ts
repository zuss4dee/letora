/**
 * In-process MCP-style tool registry for production (no separate MCP subprocess).
 * Exposes listTools / callTool so the same shapes can later back a real MCP server if needed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const rentChaserTools: McpToolDef[] = [
  {
    name: "list_chaseable_payments",
    description: "List rent payment rows that are chaseable (overdue or past-due pending).",
    inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] },
  },
  {
    name: "draft_chase_email",
    description: "Draft subject and body for one chaseable payment (LLM).",
    inputSchema: {
      type: "object",
      properties: {
        rentPaymentId: { type: "string" },
        systemContext: { type: "string" },
      },
      required: ["rentPaymentId"],
    },
  },
  {
    name: "save_agent_run",
    description: "Persist a draft agent run row.",
    inputSchema: { type: "object", properties: { payload: { type: "object" } }, required: ["payload"] },
  },
  {
    name: "send_rent_chase_email",
    description: "Send email when auto-chase is enabled (guarded in executor).",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        from: { type: "string" },
      },
      required: ["to", "subject", "body", "from"],
    },
  },
];

export function listRentChaserMcpTools(): McpToolDef[] {
  return rentChaserTools;
}

/** Placeholder for future JSON-RPC bridge; returns tool definitions for discovery. */
export function mcpToolsListHandler(): { tools: McpToolDef[] } {
  return { tools: rentChaserTools };
}

/**
 * Minimal call router — real execution lives in `rent-chaser.ts` and email helpers.
 * Use for tests or future MCP wire-up.
 */
export async function callRentChaserToolPlaceholder(
  _supabase: SupabaseClient,
  name: string,
  _args: Record<string, unknown>,
): Promise<{ ok: boolean; note: string }> {
  const known = rentChaserTools.some((t) => t.name === name);
  if (!known) return { ok: false, note: `Unknown tool: ${name}` };
  return { ok: true, note: "Execute via runRentChaserAgent / tool executors in app code." };
}
