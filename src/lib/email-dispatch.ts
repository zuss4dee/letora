/** Shared types and helpers for the Emails Sent dashboard (no server actions). */

export type EmailDispatchRow = {
  id: string;
  source: "email_log" | "email_draft";
  recipientName: string;
  recipientEmail: string;
  /** True when the recipient is a tenant on file, an onboarding/rent chase to tenant, or a tenant-linked draft. */
  isTenantRecipient: boolean;
  subject: string;
  body: string;
  sentAt: string;
  uiStatus: "delivered" | "opened" | "bounced" | "draft";
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

const TENANT_CENTRIC_AGENT_TYPES = new Set(["onboarding", "rent_chaser"]);

/**
 * Tenant-facing automated mail (onboarding welcome, rent chase, etc.).
 * Maintenance / lead / referencing are classified from recipient email vs tenant list.
 */
export function isLikelyTenantAutomatedDispatch(agentType: string | null): boolean {
  return agentType != null && TENANT_CENTRIC_AGENT_TYPES.has(agentType);
}
