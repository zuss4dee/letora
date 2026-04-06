import { BaseEmailTemplate } from "./base-template";
import { Button, Heading, Hr, Link, Section, Text } from "@react-email/components";

export type MaintenanceStatus = "received" | "in_progress" | "contractor_assigned" | "completed" | "requires_info";

const statusConfig: Record<MaintenanceStatus, { label: string; color: string; bgColor: string }> = {
  received: { label: "Received", color: "#1d4ed8", bgColor: "#dbeafe" },
  in_progress: { label: "In Progress", color: "#b45309", bgColor: "#fef3c7" },
  contractor_assigned: { label: "Contractor Assigned", color: "#7c3aed", bgColor: "#ede9fe" },
  completed: { label: "Completed", color: "#15803d", bgColor: "#dcfce7" },
  requires_info: { label: "Needs More Info", color: "#b91c1c", bgColor: "#fee2e2" },
};

interface MaintenanceUpdateEmailTemplateProps {
  tenantName: string;
  propertyAddress: string;
  requestTitle: string;
  status: MaintenanceStatus;
  updateMessage: string;
  requestUrl: string;
  requiresAction?: boolean;
}

export function MaintenanceUpdateEmailTemplate({
  tenantName,
  propertyAddress,
  requestTitle,
  status,
  updateMessage,
  requestUrl,
  requiresAction = false,
}: MaintenanceUpdateEmailTemplateProps) {
  const config = statusConfig[status];

  return (
    <BaseEmailTemplate previewText={`Maintenance update: ${requestTitle} — ${config.label}`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Maintenance request update
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {tenantName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        There&apos;s an update on your maintenance request for{" "}
        <strong>{propertyAddress}</strong>.
      </Text>

      <Section className="bg-gray-50 border border-gray-200 rounded-md p-6 my-6">
        <Text className="text-gray-700 text-sm mb-2">
          <strong>Request:</strong> {requestTitle}
        </Text>
        <Section className="inline-block my-2">
          <Text
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{ color: config.color, backgroundColor: config.bgColor }}
          >
            {config.label}
          </Text>
        </Section>
      </Section>

      <Section className="bg-white border border-gray-200 rounded-md p-4 my-4">
        <Text className="text-gray-700 text-sm leading-5">{updateMessage}</Text>
      </Section>

      {requiresAction ? (
        <Section className="my-6 text-center">
          <Button
            href={requestUrl}
            className="bg-[#1a1a2e] text-white px-8 py-3 rounded-md font-medium no-underline"
          >
            Provide Details
          </Button>
        </Section>
      ) : (
        <Section className="my-6">
          <Link
            href={requestUrl}
            className="text-[#1a1a2e] underline font-medium"
          >
            View Request Details
          </Link>
        </Section>
      )}

      <Hr className="border-gray-200 my-6" />

      <Text className="text-gray-500 text-xs leading-5">
        Reply to this email if you have questions about your maintenance
        request.
      </Text>
    </BaseEmailTemplate>
  );
}
