export type AgentApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "executed";

export type AgentApprovalActionType =
  | "send_onboarding_email"
  | "send_rent_chase_email"
  | "send_move_in_email"
  | "approve_maintenance_dispatch";

/**
 * Contract for creating a pending approval (human-in-the-loop gate before side effects).
 * Kept explicit so agents share one shape: targets, evidence, and agent_run linkage.
 */
export type CreateAgentApprovalContract = {
  agentRunId?: string | null;
  agentType: string;
  title: string;
  summary?: string | null;
  actionType: AgentApprovalActionType;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

/**
 * Row slice required to run an approved action’s side effect (after status → approved).
 */
export type AgentApprovalExecutionSlice = {
  id: string;
  action_type: AgentApprovalActionType;
  agent_run_id: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
};

export type SendOnboardingEmailApprovalPayload = {
  tenancyId: string;
  userId: string;
  emailLogId?: string | null;
};

/** Payload stored on send_rent_chase_email approvals (execution after approve). */
export type SendRentChaseEmailApprovalPayload = {
  userId: string;
  rentPaymentId: string;
  tenantId: string | null;
  propertyId: string | null;
  tenantEmail: string;
  tenantName: string;
  emailSubject: string;
  emailBody: string;
  amountOwed: number;
  daysOverdue: number;
  dueDate: string | null;
};

/** Evidence stored on send_onboarding_email approvals (dashboard + audit). */
export type SendOnboardingEmailEvidence = {
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  subject: string;
  run_correlation_id?: string;
};

/** Evidence for rent chase approvals (UI + audit). */
export type SendRentChaseEmailEvidence = {
  tenantName: string;
  tenantId: string | null;
  propertyId: string | null;
  propertyAddress: string;
  amountOwed: number;
  daysOverdue: number;
  dueDate: string | null;
  emailSubject: string;
  bodyPreview: string;
};

/** Payload for approve_maintenance_dispatch (contractor email + request linkage). */
export type ApproveMaintenanceDispatchPayload = {
  userId: string;
  maintenanceRequestId: string;
  tenancyId: string;
  propertyId: string | null;
  contractorEmail: string;
  contractorName: string;
  emailSubject: string;
  emailBody: string;
  category: string;
  priority: string;
};

/** Payload stored on send_move_in_email approvals (execution after approve). */
export type SendMoveInEmailApprovalPayload = {
  userId: string;
  tenancyId: string;
};

/** Evidence for move-in email approvals (dashboard + audit). */
export type SendMoveInEmailEvidence = {
  tenantId: string | null;
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  moveInDate: string | null;
  subject: string;
  bodyPreview: string;
};

/** Evidence for maintenance dispatch approvals (UI + audit). */
export type ApproveMaintenanceDispatchEvidence = {
  maintenanceRequestId: string;
  propertyId: string | null;
  propertyAddress: string;
  tenantName: string | null;
  category: string;
  priority: string;
  contractorName: string;
  contractorEmail: string;
  emailSubject: string;
  dispatchPreview: string;
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
