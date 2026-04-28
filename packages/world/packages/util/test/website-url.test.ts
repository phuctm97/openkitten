import { expect, test } from "vitest";
import { websitePort } from "~/lib/website-port";
import { websiteURL } from "~/lib/website-url";

test("builds the local website URL from the website port", () => {
  expect(websiteURL).toBe(`http://localhost:${websitePort}`);
});
