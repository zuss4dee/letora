import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface BaseEmailTemplateProps {
  previewText?: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";
/** Dark wordmark + gold mark for email header strip */
const logoUrl = `${baseUrl}/letora-logo-dark.svg`;

export function BaseEmailTemplate({
  previewText = "Letora notification",
  children,
  showUnsubscribe = false,
  unsubscribeUrl,
}: BaseEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans my-auto mx-auto px-2">
          <Container className="bg-white border border-gray-200 my-[40px] mx-auto max-w-[600px] rounded-lg overflow-hidden">
            <Section className="bg-background dark:bg-[#1a1a2e] p-6 text-center">
              <Img
                src={logoUrl}
                alt="Letora"
                width="120"
                height="40"
                className="mx-auto"
              />
            </Section>

            <Container className="p-8">{children}</Container>

            {showUnsubscribe && unsubscribeUrl && (
              <Section className="p-6 bg-gray-50 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  You received this email from Letora.{" "}
                  <Link
                    href={unsubscribeUrl}
                    className="text-gray-500 underline"
                  >
                    Unsubscribe
                  </Link>
                </Text>
              </Section>
            )}

            <Section className="p-6 bg-gray-100 border-t border-gray-200">
              <Text className="text-xs text-gray-500 text-center">
                Letora Property Management |{" "}
                <Link href={baseUrl} className="text-gray-500 underline">
                  {baseUrl}
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
