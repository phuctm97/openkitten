import { expect, test } from "vitest";
import { grammyFormatOwnerOnly } from "~/lib/grammy-format-owner-only";

test("returns a non-empty array of chunks", () => {
  const chunks = grammyFormatOwnerOnly();
  expect(chunks.length).toBeGreaterThan(0);
});

test("each chunk has text containing owner", () => {
  const chunks = grammyFormatOwnerOnly();
  for (const chunk of chunks) {
    expect(chunk.text).toContain("owner");
  }
});
