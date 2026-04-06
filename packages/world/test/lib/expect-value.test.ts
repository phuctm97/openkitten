import { expect, test } from "vitest";

import { expectValue } from "~/lib/expect-value";

test("returns the value when it is present", () => {
  expect(expectValue("Lantern House", "Expected a value.")).toBe(
    "Lantern House",
  );
});

test("throws when the value is missing", () => {
  expect(() => {
    expectValue(undefined, "Expected a value.");
  }).toThrowError("Expected a value.");
});
