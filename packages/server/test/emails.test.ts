import { render } from "@react-email/components";
import { expect, it } from "vitest";
import EmailVerification from "../lib/emails/email-verification";
import PasswordReset from "../lib/emails/password-reset";
import { websiteURL } from "../lib/website-url";

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

it("renders the password reset template with a custom URL", async () => {
  const resetURL = new URL("/reset?token=xyz", websiteURL).toString();
  const html = await render(PasswordReset({ url: resetURL }));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("Reset your password on OpenKitten");
  expect(normalizedHTML).toContain("reset your password for your");
  expect(normalizedHTML).toContain(resetURL);
  expect(normalizedHTML).toContain("Reset password");
});

it("falls back to the website URL in the password reset template", async () => {
  const html = await render(PasswordReset({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain(websiteURL);
  expect(normalizedHTML).toContain(
    "If you didn&#x27;t request a password reset link",
  );
});
