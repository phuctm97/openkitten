import { expect, test } from "vitest";
import { formatError } from "~/lib/format-error";

test("formats Error with stack trace", () => {
  const error = new Error("something broke");
  const chunks = formatError(error);
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❌");
  expect(text).toContain("An error occurred");
  expect(text).toContain("something broke");
});

test("formats non-Error value", () => {
  const chunks = formatError("raw string error");
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❌");
  expect(text).toContain("An error occurred");
  expect(text).toContain("raw string error");
});
