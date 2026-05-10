import { BaseEmailTemplate } from "./base-template";
import { Button, Heading, Hr, Link, Section, Text } from "@react-email/components";

interface WelcomeEmailTemplateProps {
  tenantName: string;
  propertyAddress: string;
  onboardingUrl: string;
  startDate: string;
}

export function WelcomeEmailTemplate({
  tenantName,
  propertyAddress,
  onboardingUrl,
  startDate,
}: WelcomeEmailTemplateProps) {
  return (
    <BaseEmailTemplate previewText={`Welcome to Letora: your tenancy at ${propertyAddress} starts ${startDate}`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Welcome to your new home!
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {tenantName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        Welcome aboard! Your tenancy at <strong>{propertyAddress}</strong> is
        confirmed and your move-in date is <strong>{startDate}</strong>.
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        To get started, please complete your onboarding process. This includes
        reviewing your contract, setting up payment details, and providing any
        required documentation.
      </Text>

      <Section className="my-6 text-center">
        <Button
          href={onboardingUrl}
          className="bg-background dark:bg-[#1a1a2e] text-white px-8 py-3 rounded-md font-medium no-underline"
        >
          Complete Onboarding
        </Button>
      </Section>

      <Text className="text-gray-600 text-sm leading-5">
        If you have any questions, just reply to this email. We&apos;re here to
        help.
      </Text>

      <Hr className="border-gray-200 my-6" />

      <Text className="text-gray-500 text-sm">
        Tenancy details:{" "}
        <Link href={onboardingUrl} className="text-[#1a1a2e] underline">
          View your onboarding portal
        </Link>
      </Text>
    </BaseEmailTemplate>
  );
}
