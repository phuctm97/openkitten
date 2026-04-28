import { websiteURL } from "@openkitten/world-util";
import { render } from "react-email";
import { expect, it } from "vitest";
import MagicLink from "~/lib/emails/magic-link";

it("renders the magic-link template with a custom URL", async () => {
  const magicLinkURL = new URL(
    "/auth/magic-link?token=abc",
    websiteURL,
  ).toString();
  const html = await render(MagicLink({ url: magicLinkURL }));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain(
    "Sign in to OpenKitten with this magic link",
  );
  expect(normalizedHTML).toContain("Sign in to OpenKitten");
  expect(normalizedHTML).toContain(magicLinkURL);
  expect(normalizedHTML).toContain("OpenKitten");
});

it("falls back to the website URL in the magic-link template", async () => {
  const html = await render(MagicLink({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain(websiteURL);
  expect(normalizedHTML).toContain("If you didn&#x27;t request a sign-in link");
});
