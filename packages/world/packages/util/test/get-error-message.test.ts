import { expect, test } from "vitest";
import { getErrorMessage } from "~/lib/get-error-message";

test("returns the message of an Error instance", () => {
  expect(getErrorMessage(new Error("boom"))).toBe("boom");
});

test("returns a non-empty string passed directly", () => {
  expect(getErrorMessage("not an Error")).toBe("not an Error");
});

test("prefers the nested error.message when present", () => {
  expect(
    getErrorMessage({
      error: { message: "Nested failure" },
      message: "Top-level failure",
    }),
  ).toBe("Nested failure");
});

test("falls back to the top-level message when no nested error.message exists", () => {
  expect(getErrorMessage({ message: "Plain failure" })).toBe("Plain failure");
});

test("returns the fallback for non-Error throwables without usable messages", () => {
  expect(getErrorMessage(42)).toBe("Something went wrong");
  expect(getErrorMessage(null)).toBe("Something went wrong");
  expect(getErrorMessage(undefined)).toBe("Something went wrong");
  expect(getErrorMessage("")).toBe("Something went wrong");
  expect(getErrorMessage("   ")).toBe("Something went wrong");
  expect(getErrorMessage({ error: {} })).toBe("Something went wrong");
  expect(getErrorMessage({ error: null })).toBe("Something went wrong");
  expect(getErrorMessage({ message: "" })).toBe("Something went wrong");
  expect(getErrorMessage({ error: { message: "   " } })).toBe(
    "Something went wrong",
  );
});
