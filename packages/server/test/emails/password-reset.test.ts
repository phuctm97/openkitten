import { render } from "@react-email/components";
import { expect, it } from "vitest";
import PasswordReset from "../../lib/emails/password-reset";
import { websiteURL } from "../../lib/website-url";

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
