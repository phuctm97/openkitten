import { beforeEach, expect, test, vi } from "vitest";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import { logger } from "~/lib/logger";

function mockBot() {
  return { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
}

let bot: ReturnType<typeof mockBot>;

beforeEach(() => {
  bot = mockBot();
});

function send(
  chunks: Array<{ text: string; markdown?: string }>,
  options?: {
    readonly threadId?: number;
    readonly replyToMessageId?: number;
  },
) {
  return grammySendChunks({
    bot: bot as never,
    chunks,
    chatId: 123,
    threadId: options?.threadId,
    replyToMessageId: options?.replyToMessageId,
  });
}

const noPreview = { is_disabled: true };

test("sends plain text chunk", async () => {
  await send([{ text: "hello" }]);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    link_preview_options: noPreview,
  });
});

test("sends MarkdownV2 chunk", async () => {
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "*hello*", {
    parse_mode: "MarkdownV2",
    link_preview_options: noPreview,
  });
});

test("falls back to plain text when MarkdownV2 fails", async () => {
  bot.api.sendMessage
    .mockRejectedValueOnce(new Error("parse error"))
    .mockResolvedValueOnce(undefined);
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(logger.warn).toHaveBeenCalledWith(
    "Failed to send MarkdownV2, falling back to text",
    expect.any(Error),
    {
      markdown: "*hello*",
      text: "hello",
      chatId: 123,
      threadId: undefined,
    },
  );
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    link_preview_options: noPreview,
  });
});

test("includes thread id in send options", async () => {
  await send([{ text: "hello" }], { threadId: 456 });
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    link_preview_options: noPreview,
    message_thread_id: 456,
  });
});

test("sends multiple chunks in order", async () => {
  const calls: string[] = [];
  bot.api.sendMessage.mockImplementation((_chatId: number, text: string) => {
    calls.push(text);
    return Promise.resolve(undefined);
  });
  await send([{ text: "first" }, { text: "second" }, { text: "third" }]);
  expect(calls).toEqual(["first", "second", "third"]);
});

test("includes reply parameters in send options", async () => {
  await send([{ text: "hello" }], { replyToMessageId: 789 });
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    link_preview_options: noPreview,
    reply_parameters: { message_id: 789 },
  });
});

test("replies only with the first chunk", async () => {
  await send([{ text: "first" }, { text: "second" }, { text: "third" }], {
    replyToMessageId: 789,
    threadId: 456,
  });
  expect(bot.api.sendMessage).toHaveBeenNthCalledWith(1, 123, "first", {
    link_preview_options: noPreview,
    message_thread_id: 456,
    reply_parameters: { message_id: 789 },
  });
  expect(bot.api.sendMessage).toHaveBeenNthCalledWith(2, 123, "second", {
    link_preview_options: noPreview,
    message_thread_id: 456,
  });
  expect(bot.api.sendMessage).toHaveBeenNthCalledWith(3, 123, "third", {
    link_preview_options: noPreview,
    message_thread_id: 456,
  });
});

test("throws on send error", async () => {
  bot.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await expect(send([{ text: "fail" }])).rejects.toThrow("network error");
});
