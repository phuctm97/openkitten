import { expect, test } from "vitest";

import { formatError } from "~/lib/format-error";

test("prefers nested error messages", () => {
  expect(
    formatError({
      error: {
        message: "Nested failure",
      },
      message: "Top-level failure",
    }),
  ).toBe("Nested failure");
});

test("falls back to top-level error messages", () => {
  expect(formatError(new Error("Plain failure"))).toBe("Plain failure");
});

test("returns a fallback when no usable message exists", () => {
  expect(formatError("not-an-error")).toBe("Something went wrong");
  expect(formatError({ error: {} })).toBe("Something went wrong");
  expect(formatError({ message: "" })).toBe("Something went wrong");
  expect(formatError({ error: { message: "   " } })).toBe(
    "Something went wrong",
  );
});
