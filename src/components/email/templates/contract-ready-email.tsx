import { BaseEmailTemplate } from "./base-template";
import { Button, Heading, Link, Section, Text } from "@react-email/components";

interface ContractReadyEmailTemplateProps {
  tenantName: string;
  propertyAddress: string;
  contractUrl: string;
  deadline?: string;
}

export function ContractReadyEmailTemplate({
  tenantName,
  propertyAddress,
  contractUrl,
  deadline,
}: ContractReadyEmailTemplateProps) {
  return (
    <BaseEmailTemplate previewText={`Your contract for ${propertyAddress} is ready to review and sign`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Your contract is ready
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {tenantName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        Your tenancy agreement for <strong>{propertyAddress}</strong> has been
        prepared and is ready for your review.
      </Text>

      {deadline && (
        <Section className="bg-amber-50 border border-amber-200 rounded-md p-4 my-4">
          <Text className="text-amber-800 text-sm font-medium">
            Please review and sign by {deadline} to keep your onboarding on
            track.
          </Text>
        </Section>
      )}

      <Text className="text-gray-700 text-base leading-6">
        Please review the contract carefully. If everything looks good, you can
        sign it electronically.
      </Text>

      <Section className="my-6 text-center">
        <Button
          href={contractUrl}
          className="bg-[#1a1a2e] text-white px-8 py-3 rounded-md font-medium no-underline"
        >
          Review & Sign Contract
        </Button>
      </Section>

      <Text className="text-gray-600 text-sm leading-5">
        If you have questions about any terms in the contract, reply to this
        email and we&apos;ll clarify.
      </Text>
    </BaseEmailTemplate>
  );
}
