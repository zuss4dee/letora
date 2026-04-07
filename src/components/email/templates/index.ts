export { BaseEmailTemplate } from "./base-template";
export { WelcomeEmailTemplate } from "./welcome-email";
export { ContractReadyEmailTemplate } from "./contract-ready-email";
export { RentReminderEmailTemplate } from "./rent-reminder-email";
export { PaymentReceiptEmailTemplate } from "./payment-receipt-email";
export { MaintenanceUpdateEmailTemplate } from "./maintenance-update-email";
export { LeadFollowUpEmailTemplate } from "./lead-followup-email";

export type { MaintenanceStatus } from "./maintenance-update-email";

export type EmailTemplateType =
  | "welcome"
  | "contract_ready"
  | "rent_reminder"
  | "payment_receipt"
  | "maintenance_update"
  | "lead_followup";

export {
  renderEmailTemplate,
  renderWelcomeEmail,
  renderContractReadyEmail,
  renderRentReminderEmail,
  renderPaymentReceiptEmail,
  renderMaintenanceUpdateEmail,
  renderLeadFollowUpEmail,
  templateRegistry,
  bumpTemplateVersion,
} from "./registry";

export type {
  WelcomeEmailProps,
  ContractReadyEmailProps,
  RentReminderEmailProps,
  PaymentReceiptEmailProps,
  MaintenanceUpdateEmailProps,
  LeadFollowUpEmailProps,
  TemplateVersion,
  TemplateDefinition,
  RenderedTemplate,
} from "./registry";
