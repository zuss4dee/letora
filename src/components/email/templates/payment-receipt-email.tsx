import { BaseEmailTemplate } from "./base-template";
import { Heading, Hr, Link, Section, Text } from "@react-email/components";

interface PaymentReceiptEmailTemplateProps {
  tenantName: string;
  propertyAddress: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  receiptUrl: string;
  transactionId: string;
}

export function PaymentReceiptEmailTemplate({
  tenantName,
  propertyAddress,
  amount,
  paymentDate,
  paymentMethod,
  receiptUrl,
  transactionId,
}: PaymentReceiptEmailTemplateProps) {
  return (
    <BaseEmailTemplate previewText={`Payment receipt: ${amount} received on ${paymentDate}`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Payment received
      </Heading>

      <Text className="text-gray-700 text-base leading-6">
        Hi {tenantName},
      </Text>

      <Text className="text-gray-700 text-base leading-6">
        Thank you! We&apos;ve received your rent payment for{" "}
        <strong>{propertyAddress}</strong>.
      </Text>

      <Section className="bg-green-50 border border-green-200 rounded-md p-6 my-6">
        <Text className="text-green-800 text-sm mb-2">
          <strong>Amount paid:</strong> {amount}
        </Text>
        <Text className="text-green-800 text-sm mb-2">
          <strong>Date:</strong> {paymentDate}
        </Text>
        <Text className="text-green-800 text-sm mb-2">
          <strong>Payment method:</strong> {paymentMethod}
        </Text>
        <Text className="text-green-800 text-sm">
          <strong>Transaction ID:</strong> {transactionId}
        </Text>
      </Section>

      <Text className="text-gray-700 text-base leading-6">
        You can view and download your receipt at any time.
      </Text>

      <Section className="my-6">
        <Link
          href={receiptUrl}
          className="text-[#1a1a2e] underline font-medium"
        >
          View Receipt
        </Link>
      </Section>

      <Hr className="border-gray-200 my-6" />

      <Text className="text-gray-500 text-xs leading-5">
        This is an automated receipt. No action is required.
      </Text>
    </BaseEmailTemplate>
  );
}
