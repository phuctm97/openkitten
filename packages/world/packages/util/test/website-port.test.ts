import { expect, test } from "vitest";
import { websitePort } from "~/lib/website-port";

test("defines the hard-coded local website port", () => {
  expect(websitePort).toBe(41239);
});
