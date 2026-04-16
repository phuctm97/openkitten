import { expect, test } from "vitest";
import { grammyExtractReplyContext } from "~/lib/grammy-extract-reply-context";

function mockCtx(reply?: Record<string, unknown>) {
  return { message: reply ? { reply_to_message: reply } : {} } as never;
}

test("returns undefined when no reply_to_message", () => {
  expect(grammyExtractReplyContext(mockCtx())).toBeUndefined();
});

test("returns formatted string with sender first_name for text reply", () => {
  const result = grammyExtractReplyContext(
    mockCtx({ text: "hello world", from: { first_name: "Alice" } }),
  );
  expect(result).toBe('[Replying to Alice: "hello world"]');
});

test("uses caption when text is absent", () => {
  const result = grammyExtractReplyContext(
    mockCtx({ caption: "photo caption", from: { first_name: "Bob" } }),
  );
  expect(result).toBe('[Replying to Bob: "photo caption"]');
});

test("returns undefined when reply has neither text nor caption", () => {
  const result = grammyExtractReplyContext(
    mockCtx({ from: { first_name: "Alice" } }),
  );
  expect(result).toBeUndefined();
});

test("truncates text longer than 300 characters", () => {
  const longText = "a".repeat(400);
  const result = grammyExtractReplyContext(
    mockCtx({ text: longText, from: { first_name: "Alice" } }),
  );
  expect(result).toBe(`[Replying to Alice: "${"a".repeat(300)}..."]`);
});

test("does not truncate text exactly 300 characters", () => {
  const text = "b".repeat(300);
  const result = grammyExtractReplyContext(
    mockCtx({ text, from: { first_name: "Alice" } }),
  );
  expect(result).toBe(`[Replying to Alice: "${text}"]`);
});

test("uses 'a message' when from is undefined", () => {
  const result = grammyExtractReplyContext(mockCtx({ text: "hi" }));
  expect(result).toBe('[Replying to a message: "hi"]');
});

test("uses username when first_name is missing", () => {
  const result = grammyExtractReplyContext(
    mockCtx({ text: "hi", from: { username: "charlie" } }),
  );
  expect(result).toBe('[Replying to charlie: "hi"]');
});
