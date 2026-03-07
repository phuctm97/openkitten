import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { formatError } from "~/lib/format-error";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats Error with stack trace and Trace label", () => {
  const error = new Error("something broke");
  const chunks = formatError(error);
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❌");
  expect(text).toContain("An error occurred");
  expect(text).toContain("something broke");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```Trace\n");
});

test("formats non-Error value", () => {
  const chunks = formatError("raw string error");
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❌");
  expect(text).toContain("An error occurred");
  expect(text).toContain("raw string error");
});

test("preserves Trace label when markdown is absent", () => {
  vi.mocked(convert).mockImplementation(() => {
    throw new Error("conversion failed");
  });
  const chunks = formatError(new Error("fail"));
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("An error occurred");
});
