import { render } from "react-email";
import { expect, it } from "vitest";
import EmailVerification from "~/lib/emails/email-verification";
import { websiteURL } from "~/lib/website-url";

it("renders the email verification template with a custom URL", async () => {
  const verificationURL = new URL("/verify?token=abc", websiteURL).toString();
  const html = await render(EmailVerification({ url: verificationURL }));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("Verify your email address on OpenKitten");
  expect(normalizedHTML).toContain("Welcome to OpenKitten!");
  expect(normalizedHTML).toContain(verificationURL);
  expect(normalizedHTML).toContain("OpenKitten");
});

it("falls back to the website URL in the email verification template", async () => {
  const html = await render(EmailVerification({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain(websiteURL);
  expect(normalizedHTML).toContain(
    "If you didn&#x27;t create a OpenKitten account",
  );
});
