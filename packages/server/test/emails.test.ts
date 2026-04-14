import { render } from "@react-email/components";
import { expect, it } from "vitest";
import EmailVerification from "../lib/emails/email-verification";
import PasswordReset from "../lib/emails/password-reset";

it("renders the email verification template with a custom URL", async () => {
  const html = await render(
    EmailVerification({ url: "https://openkitten.com/verify?token=abc" }),
  );
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("Verify your email address on OpenKitten");
  expect(normalizedHTML).toContain("Welcome to OpenKitten!");
  expect(normalizedHTML).toContain("https://openkitten.com/verify?token=abc");
  expect(normalizedHTML).toContain("OpenKitten");
});

it("falls back to the website URL in the email verification template", async () => {
  const html = await render(EmailVerification({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("https://openkitten.com");
  expect(normalizedHTML).toContain(
    "If you didn&#x27;t create a OpenKitten account",
  );
});

it("renders the password reset template with a custom URL", async () => {
  const html = await render(
    PasswordReset({ url: "https://openkitten.com/reset?token=xyz" }),
  );
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("Reset your password on OpenKitten");
  expect(normalizedHTML).toContain("reset your password for your");
  expect(normalizedHTML).toContain("https://openkitten.com/reset?token=xyz");
  expect(normalizedHTML).toContain("Reset password");
});

it("falls back to the website URL in the password reset template", async () => {
  const html = await render(PasswordReset({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("https://openkitten.com");
  expect(normalizedHTML).toContain(
    "If you didn&#x27;t request a password reset link",
  );
});
