import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

function mockBot() {
  return { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
}

let bot: ReturnType<typeof mockBot>;

beforeEach(() => {
  bot = mockBot();
});

function send(
  chunks: Array<{ text: string; markdown?: string }>,
  options?: { readonly threadId?: number; readonly ignoreErrors?: boolean },
) {
  return grammySendChunks({
    bot: bot as never,
    chunks,
    chatId: 123,
    threadId: options?.threadId,
    ignoreErrors: options?.ignoreErrors ?? false,
  });
}

test("sends plain text chunk", async () => {
  await send([{ text: "hello" }]);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("sends MarkdownV2 chunk", async () => {
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "*hello*", {
    parse_mode: "MarkdownV2",
  });
});

test("falls back to plain text when MarkdownV2 fails", async () => {
  bot.api.sendMessage
    .mockRejectedValueOnce(new Error("parse error"))
    .mockResolvedValueOnce(undefined);
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(consola.warn).toHaveBeenCalledWith(
    "Failed to send MarkdownV2, falling back to text",
    {
      error: expect.any(Error),
      markdown: "*hello*",
      text: "hello",
      chatId: 123,
      threadId: undefined,
    },
  );
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("includes thread id in send options", async () => {
  await send([{ text: "hello" }], { threadId: 456 });
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
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

test("ignoreErrors logs and stops on error", async () => {
  bot.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await send([{ text: "fail" }, { text: "skipped" }], { ignoreErrors: true });
  expect(consola.error).toHaveBeenCalledWith(
    "Failed to send message to Telegram",
    {
      error: expect.any(Error),
      chunks: expect.any(Array),
      chatId: 123,
      threadId: undefined,
    },
  );
  expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
});

test("throws when ignoreErrors is false", async () => {
  bot.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await expect(send([{ text: "fail" }])).rejects.toThrow("network error");
});

test("ignoreErrors catches fallback failure too", async () => {
  bot.api.sendMessage
    .mockRejectedValueOnce(new Error("markdown error"))
    .mockRejectedValueOnce(new Error("fallback error"));
  await send([{ text: "hello", markdown: "*hello*" }], { ignoreErrors: true });
  expect(consola.error).toHaveBeenCalledWith(
    "Failed to send message to Telegram",
    {
      error: expect.any(Error),
      chunks: expect.any(Array),
      chatId: 123,
      threadId: undefined,
    },
  );
});
