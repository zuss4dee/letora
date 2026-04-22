export type AgentApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "executed";

export type AgentApprovalActionType =
  | "send_onboarding_email";

export type SendOnboardingEmailApprovalPayload = {
  tenancyId: string;
  userId: string;
  emailLogId?: string | null;
};

export type AgentApprovalRow = {
  id: string;
  user_id: string;
  agent_run_id: string | null;
  agent_type: string;
  title: string;
  summary: string | null;
  action_type: AgentApprovalActionType;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  evidence: Record<string, unknown>;
  status: AgentApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  deny_reason: string | null;
  executed_at: string | null;
  created_at: string;
};
