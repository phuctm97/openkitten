import { expect, test } from "vitest";
import { opencodeCheckGoneError } from "~/lib/opencode-check-gone-error";

test("returns true for NotFoundError", () => {
  expect(
    opencodeCheckGoneError({
      name: "NotFoundError",
      data: { message: "not found" },
    }),
  ).toBe(true);
});

test("returns false for other named errors", () => {
  expect(
    opencodeCheckGoneError({
      name: "BadRequestError",
      data: {},
    }),
  ).toBe(false);
});

test("returns false for plain Error", () => {
  expect(opencodeCheckGoneError(new Error("not found"))).toBe(false);
});

test("returns false for null", () => {
  expect(opencodeCheckGoneError(null)).toBe(false);
});

test("returns false for undefined", () => {
  expect(opencodeCheckGoneError(undefined)).toBe(false);
});

test("returns false for string", () => {
  expect(opencodeCheckGoneError("NotFoundError")).toBe(false);
});
