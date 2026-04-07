import { render } from "@react-email/components";

import type { EmailTemplateType } from "./index";
import type { MaintenanceStatus } from "./maintenance-update-email";
import { WelcomeEmailTemplate } from "./welcome-email";
import { ContractReadyEmailTemplate } from "./contract-ready-email";
import { RentReminderEmailTemplate } from "./rent-reminder-email";
import { PaymentReceiptEmailTemplate } from "./payment-receipt-email";
import { MaintenanceUpdateEmailTemplate } from "./maintenance-update-email";
import { LeadFollowUpEmailTemplate } from "./lead-followup-email";

// --- Template prop types ---

export type WelcomeEmailProps = {
  tenantName: string;
  propertyAddress: string;
  onboardingUrl: string;
  startDate: string;
};

export type ContractReadyEmailProps = {
  tenantName: string;
  propertyAddress: string;
  contractUrl: string;
  deadline?: string;
};

export type RentReminderEmailProps = {
  tenantName: string;
  propertyAddress: string;
  amount: string;
  dueDate: string;
  paymentUrl: string;
};

export type PaymentReceiptEmailProps = {
  tenantName: string;
  propertyAddress: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  receiptUrl: string;
  transactionId: string;
};

export type MaintenanceUpdateEmailProps = {
  tenantName: string;
  propertyAddress: string;
  requestTitle: string;
  status: MaintenanceStatus;
  updateMessage: string;
  requestUrl: string;
  requiresAction?: boolean;
};

export type LeadFollowUpEmailProps = {
  leadName: string;
  propertyName?: string;
  message: string;
  replyUrl: string;
  agentName?: string;
};

// --- Versioned template registry ---

export type TemplateVersion = {
  version: number;
  createdAt: string;
  notes?: string;
};

export type TemplateDefinition = {
  type: EmailTemplateType;
  currentVersion: number;
  versions: TemplateVersion[];
};

export type RenderedTemplate = {
  html: string;
  text: string;
  subject: string;
};

// Template registry: add new versions here
export const templateRegistry: Record<
  EmailTemplateType,
  TemplateDefinition
> = {
  welcome: {
    type: "welcome",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial template with onboarding CTA",
      },
    ],
  },
  contract_ready: {
    type: "contract_ready",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial template with sign deadline",
      },
    ],
  },
  rent_reminder: {
    type: "rent_reminder",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial template with payment details card",
      },
    ],
  },
  payment_receipt: {
    type: "payment_receipt",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial receipt template with transaction details",
      },
    ],
  },
  maintenance_update: {
    type: "maintenance_update",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial template with status badge and action CTA",
      },
    ],
  },
  lead_followup: {
    type: "lead_followup",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-04-05",
        notes: "Initial follow-up template with reply CTA",
      },
    ],
  },
};

async function renderTemplateHtml(
  element: React.ReactElement,
): Promise<{ html: string; text: string }> {
  const html = await render(element, { pretty: true });
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { html, text };
}

// --- Factory functions ---

export async function renderWelcomeEmail(
  props: WelcomeEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <WelcomeEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: "Welcome to Letora: your new home awaits",
  };
}

export async function renderContractReadyEmail(
  props: ContractReadyEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <ContractReadyEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: "Your contract is ready to review and sign",
  };
}

export async function renderRentReminderEmail(
  props: RentReminderEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <RentReminderEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: `Rent payment reminder, due ${props.dueDate}`,
  };
}

export async function renderPaymentReceiptEmail(
  props: PaymentReceiptEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <PaymentReceiptEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: `Payment received: ${props.amount}`,
  };
}

export async function renderMaintenanceUpdateEmail(
  props: MaintenanceUpdateEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <MaintenanceUpdateEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: `Maintenance update: ${props.requestTitle} (${props.status.replace("_", " ")})`,
  };
}

export async function renderLeadFollowUpEmail(
  props: LeadFollowUpEmailProps,
): Promise<RenderedTemplate> {
  const { html, text } = await renderTemplateHtml(
    <LeadFollowUpEmailTemplate {...props} />
  );
  return {
    html,
    text,
    subject: props.agentName
      ? `Follow-up from ${props.agentName} at Letora`
      : "Follow-up from Letora",
  };
}

// --- Version bump helper ---

export function bumpTemplateVersion(
  type: EmailTemplateType,
  notes?: string,
): TemplateVersion {
  const def = templateRegistry[type];
  const newVersion = def.currentVersion + 1;
  const version: TemplateVersion = {
    version: newVersion,
    createdAt: new Date().toISOString().split("T")[0],
    notes,
  };
  def.versions.push(version);
  def.currentVersion = newVersion;
  return version;
}

// --- Template renderer dispatcher ---

const renderers: Record<
  EmailTemplateType,
  (props: Record<string, unknown>) => Promise<RenderedTemplate>
> = {
  welcome: renderWelcomeEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
  contract_ready: renderContractReadyEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
  rent_reminder: renderRentReminderEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
  payment_receipt: renderPaymentReceiptEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
  maintenance_update: renderMaintenanceUpdateEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
  lead_followup: renderLeadFollowUpEmail as (props: Record<string, unknown>) => Promise<RenderedTemplate>,
};

export async function renderEmailTemplate(
  type: EmailTemplateType,
  props: Record<string, unknown>,
): Promise<RenderedTemplate> {
  const renderer = renderers[type];
  if (!renderer) {
    throw new Error(`Unknown template type: ${type}`);
  }
  return renderer(props);
}
