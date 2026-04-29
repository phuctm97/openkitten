import { websiteURL } from "@openkitten/world-util";
import { render } from "react-email";
import { expect, it } from "vitest";
import Invitation from "~/lib/emails/invitation";

it("renders the invitation template with custom org and inviter", async () => {
  const invitationURL = new URL(
    "/accept-invitation?invitationId=abc",
    websiteURL,
  ).toString();
  const html = await render(
    Invitation({
      organizationName: "Acme Co",
      inviterName: "Ada Lovelace",
      url: invitationURL,
    }),
  );
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain("Acme Co");
  expect(normalizedHTML).toContain("Ada Lovelace");
  expect(normalizedHTML).toContain(invitationURL);
  expect(normalizedHTML).toContain("OpenKitten");
  expect(normalizedHTML).toContain("Accept invitation");
});

it("falls back to defaults in the invitation template", async () => {
  const html = await render(Invitation({}));
  const normalizedHTML = html.replaceAll("<!-- -->", "");

  expect(normalizedHTML).toContain(websiteURL);
  expect(normalizedHTML).toContain("An OpenKitten House");
  expect(normalizedHTML).toContain("An OpenKitten member");
});
