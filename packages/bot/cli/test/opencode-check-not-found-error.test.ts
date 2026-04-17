import { expect, test } from "vitest";
import { opencodeCheckNotFoundError } from "~/lib/opencode-check-not-found-error";

test("returns true for NotFoundError", () => {
  expect(
    opencodeCheckNotFoundError({
      name: "NotFoundError",
      data: { message: "not found" },
    }),
  ).toBe(true);
});

test("returns false for other named errors", () => {
  expect(
    opencodeCheckNotFoundError({
      name: "BadRequestError",
      data: {},
    }),
  ).toBe(false);
});

test("returns false for plain Error", () => {
  expect(opencodeCheckNotFoundError(new Error("not found"))).toBe(false);
});

test("returns false for null", () => {
  expect(opencodeCheckNotFoundError(null)).toBe(false);
});

test("returns false for undefined", () => {
  expect(opencodeCheckNotFoundError(undefined)).toBe(false);
});

test("returns false for string", () => {
  expect(opencodeCheckNotFoundError("NotFoundError")).toBe(false);
});
