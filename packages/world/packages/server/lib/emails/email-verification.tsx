import { iconURL, websiteURL } from "@openkitten/world-util";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";
import {
  backgroundColor,
  borderColor,
  cardColor,
  fontFamily,
  footerColor,
  foregroundColor,
  mutedForegroundColor,
  primaryColor,
  primaryForegroundColor,
  radiusLg,
  radiusMd,
  shadowColor,
} from "~/lib/emails/theme";

export interface EmailVerificationProps {
  url?: string;
}

export default function EmailVerification({
  url = websiteURL,
}: EmailVerificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address on OpenKitten</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <table style={logoTable}>
              <tr>
                <td style={logoImageCell}>
                  <Img src={iconURL} width={28} height={28} alt="OpenKitten" />
                </td>
                <td style={logoTextCell}>
                  <Text style={logoText}>OpenKitten</Text>
                </td>
              </tr>
            </table>
          </Section>
          <Section style={card}>
            <div style={cardContent}>
              <Heading style={heading}>Verify your email</Heading>
              <Text style={subheading}>
                Welcome to OpenKitten! Please confirm your email address to get
                started.
              </Text>
              <Text style={centeredParagraph}>
                Click the button below to verify your email address. This link
                will expire in 1 hour.
              </Text>
              <Section style={buttonContainer}>
                <Button style={button} href={url}>
                  Verify email
                </Button>
              </Section>
              <Text style={footerText}>
                If you didn't create a OpenKitten account, you can safely ignore
                this email.
              </Text>
            </div>
          </Section>
          <Text style={footer}>
            © {new Date().getFullYear()} OpenKitten. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor,
  fontFamily,
  padding: "32px 16px",
};

const container = {
  margin: "0 auto",
  maxWidth: "480px",
};

const logoSection = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const logoTable = {
  margin: "0 auto",
  borderCollapse: "collapse" as const,
};

const logoImageCell = {
  padding: "0",
  paddingRight: "8px",
  verticalAlign: "middle" as const,
};

const logoTextCell = {
  padding: "0",
  verticalAlign: "middle" as const,
};

const logoText = {
  fontFamily,
  fontSize: "20px",
  fontWeight: "600" as const,
  letterSpacing: "0",
  color: primaryColor,
  margin: "0",
  display: "inline-block",
};

const card = {
  backgroundColor: cardColor,
  borderRadius: radiusLg,
  padding: "32px 16px",
  border: `1px solid ${borderColor}`,
  boxShadow: `0 14px 36px -24px ${shadowColor}`,
};

const cardContent = {
  maxWidth: "400px",
  margin: "0 auto",
};

const heading = {
  fontFamily,
  color: foregroundColor,
  fontSize: "28px",
  fontWeight: "700" as const,
  letterSpacing: "0",
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const subheading = {
  color: mutedForegroundColor,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 32px",
  textAlign: "center" as const,
};

const centeredParagraph = {
  color: foregroundColor,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: primaryColor,
  borderRadius: radiusMd,
  color: primaryForegroundColor,
  fontSize: "16px",
  fontWeight: "600" as const,
  boxShadow: `0 10px 24px -18px ${shadowColor}`,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
  width: "100%",
  maxWidth: "200px",
};

const footerText = {
  color: mutedForegroundColor,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "24px auto 32px auto",
  maxWidth: "340px",
  textAlign: "center" as const,
};

const footer = {
  color: footerColor,
  fontSize: "12px",
  margin: "32px 0 0",
  textAlign: "center" as const,
};
