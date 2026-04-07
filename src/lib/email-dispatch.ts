/** Shared types and helpers for the Emails Sent dashboard (no server actions). */

export type EmailDispatchRow = {
  id: string;
  source: "email_log" | "email_draft";
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  uiStatus: "delivered" | "opened" | "bounced";
  agentType: string | null;
};

const AUTOMATED_AGENT_TYPES = new Set([
  "rent_chaser",
  "maintenance",
  "onboarding",
  "lead",
  "referencing",
]);

export function isAutomatedEmailDispatch(agentType: string | null): boolean {
  return agentType != null && AUTOMATED_AGENT_TYPES.has(agentType);
}
