import { BaseEmailTemplate } from "./base-template";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";

interface RentReminderEmailTemplateProps {
  tenantName: string;
  propertyAddress: string;
  amount: string;
  dueDate: string;
  paymentUrl: string;
}

export function RentReminderEmailTemplate({
  tenantName,
  propertyAddress,
  amount,
  dueDate,
  paymentUrl,
}: RentReminderEmailTemplateProps) {
  return (
    <BaseEmailTemplate previewText={`Rent payment reminder — ${amount} due ${dueDate}`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Rent payment reminder
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {tenantName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        This is a friendly reminder that your rent payment for{" "}
        <strong>{propertyAddress}</strong> is due soon.
      </Text>

      <Section className="bg-gray-50 border border-gray-200 rounded-md p-6 my-6">
        <Text className="text-gray-700 text-sm mb-2">
          <strong>Amount:</strong> {amount}
        </Text>
        <Text className="text-gray-700 text-sm mb-2">
          <strong>Due date:</strong> {dueDate}
        </Text>
        <Text className="text-gray-700 text-sm">
          <strong>Property:</strong> {propertyAddress}
        </Text>
      </Section>

      <Section className="my-6 text-center">
        <Button
          href={paymentUrl}
          className="bg-[#1a1a2e] text-white px-8 py-3 rounded-md font-medium no-underline"
        >
          Pay Now
        </Button>
      </Section>

      <Hr className="border-gray-200 my-6" />

      <Text className="text-gray-500 text-xs leading-5">
        If you&apos;ve already made this payment, please disregard this reminder.
      </Text>
    </BaseEmailTemplate>
  );
}
