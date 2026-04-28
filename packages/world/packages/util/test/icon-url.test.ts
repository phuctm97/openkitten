import { expect, test } from "vitest";
import { iconURL } from "~/lib/icon-url";
import { websiteURL } from "~/lib/website-url";

test("builds the icon URL relative to the website URL", () => {
  expect(iconURL).toBe(`${websiteURL}/icon.png`);
});
