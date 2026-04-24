import { expect, test } from "vitest";

import { getSlot } from "~/lib/get-slot";

test("throws for missing slots", () => {
  expect(() => getSlot("missing")).toThrow("Missing slot missing");
});
