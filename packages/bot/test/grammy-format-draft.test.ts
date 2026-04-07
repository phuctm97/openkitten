import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatDraft } from "~/lib/grammy-format-draft";
import { logger } from "~/lib/logger";

vi.mock("telegram-markdown-v2", { spy: true });

test("returns an empty chunk for empty input", () => {
  expect(grammyFormatDraft("")).toEqual({ text: "" });
  expect(grammyFormatDraft("   ")).toEqual({ text: "" });
});

test("formats simple text with MarkdownV2", () => {
  const result = grammyFormatDraft("Hello world");
  expect(result.text).toBe("Hello world");
  assert.isDefined(result.markdown);
});

test("returns only the latest section after horizontal rules", () => {
  const result = grammyFormatDraft("Before\n\n---\n\nAfter");
  expect(result.text).toBe("After");
  expect(result.markdown).toContain("After");
});

test("keeps the latest content from long text", () => {
  const words = Array.from({ length: 700 }, (_, index) => `word${index}`);
  const result = grammyFormatDraft(words.join(" "));
  expect(result.text).toContain("word699");
  expect(result.text).not.toContain("word0");
  expect((result.markdown ?? result.text).length).toBeLessThanOrEqual(4096);
});

test("reopens code blocks when trimming into the latest code", () => {
  const lines = Array.from(
    { length: 400 },
    (_, index) => `const v${index} = ${index};`,
  );
  const text = `Intro.\n\n\`\`\`ts\n${lines.join("\n")}\n\`\`\``;
  const result = grammyFormatDraft(text);
  expect(result.text.startsWith("```ts\n")).toBe(true);
  expect(result.text).toContain("const v399 = 399;");
  assert.isDefined(result.markdown);
  expect(result.markdown).toContain("```ts\n");
});

test("trims more aggressively when MarkdownV2 escaping expands the content", () => {
  const result = grammyFormatDraft("!.()_~`>#+-=|{}.!".repeat(400));
  expect((result.markdown ?? result.text).length).toBeLessThanOrEqual(4096);
  expect(result.text.length).toBeLessThanOrEqual(4096);
});

test("falls back to plain text when conversion keeps failing", () => {
  vi.mocked(convert).mockImplementation(() => {
    throw new Error("conversion failed");
  });

  const result = grammyFormatDraft("Hello world");
  expect(result).toEqual({ text: "Hello world" });
  expect(logger.warn).toHaveBeenCalledWith(
    "Failed to format draft as MarkdownV2",
    expect.any(Error),
    { chunk: "Hello world" },
  );
});

test("falls back to plain text when converted Markdown never fits", () => {
  vi.mocked(convert).mockReturnValue("x".repeat(5000));

  const result = grammyFormatDraft("Hello world");
  assert.isUndefined(result.markdown);
  expect(result.text.length).toBeLessThanOrEqual(4096);
});
