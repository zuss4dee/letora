import { BaseEmailTemplate } from "./base-template";
import { Button, Heading, Section, Text } from "@react-email/components";

interface LeadFollowUpEmailTemplateProps {
  leadName: string;
  propertyName?: string;
  message: string;
  replyUrl: string;
  agentName?: string;
}

export function LeadFollowUpEmailTemplate({
  leadName,
  propertyName,
  message,
  replyUrl,
  agentName,
}: LeadFollowUpEmailTemplateProps) {
  return (
    <BaseEmailTemplate previewText={agentName ? `Follow-up from ${agentName} at Letora` : "Follow-up from Letora"}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Following up on your enquiry
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {leadName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        {agentName ? `${agentName} from Letora` : "We"} wanted to follow up on
        your recent enquiry
        {propertyName ? ` about ${propertyName}` : ""}.
      </Text>

      <Section className="bg-gray-50 border border-gray-200 rounded-md p-4 my-4">
        <Text className="text-gray-700 text-sm leading-5 italic">
          {message}
        </Text>
      </Section>

      <Text className="text-gray-700 text-base leading-6">
        We&apos;d love to help you find the right property. Feel free to reply to
        this email with any questions or to arrange a viewing.
      </Text>

      <Section className="my-6 text-center">
        <Button
          href={replyUrl}
          className="bg-background dark:bg-[#1a1a2e] text-white px-8 py-3 rounded-md font-medium no-underline"
        >
          Reply
        </Button>
      </Section>

      <Text className="text-gray-600 text-sm leading-5">
        Looking forward to hearing from you.
      </Text>
    </BaseEmailTemplate>
  );
}
