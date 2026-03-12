import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { sendChunks } from "~/lib/send-chunks";

function mockClient() {
  return { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
}

test("sends plain text chunk", async () => {
  const client = mockClient();
  await sendChunks({
    client: client as never,
    chunks: [{ text: "hello" }],
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("sends MarkdownV2 chunk", async () => {
  const client = mockClient();
  await sendChunks({
    client: client as never,
    chunks: [{ text: "hello", markdown: "*hello*" }],
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "*hello*", {
    parse_mode: "MarkdownV2",
  });
});

test("falls back to plain text when MarkdownV2 fails", async () => {
  const client = mockClient();
  client.api.sendMessage
    .mockRejectedValueOnce(new Error("parse error"))
    .mockResolvedValueOnce(undefined);
  await sendChunks({
    client: client as never,
    chunks: [{ text: "hello", markdown: "*hello*" }],
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(consola.debug).toHaveBeenCalledWith(
    "failed to send MarkdownV2 message, falling back to plain text",
    { error: expect.any(Error), markdown: "*hello*", text: "hello" },
  );
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("includes thread id in send options", async () => {
  const client = mockClient();
  await sendChunks({
    client: client as never,
    chunks: [{ text: "hello" }],
    ignoreErrors: false,
    chatId: 123,
    threadId: 456,
  });
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    message_thread_id: 456,
  });
});

test("sends multiple chunks in order", async () => {
  const client = mockClient();
  const calls: string[] = [];
  client.api.sendMessage.mockImplementation((_chatId: number, text: string) => {
    calls.push(text);
    return Promise.resolve(undefined);
  });
  await sendChunks({
    client: client as never,
    chunks: [{ text: "first" }, { text: "second" }, { text: "third" }],
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(calls).toEqual(["first", "second", "third"]);
});

test("ignoreErrors logs and stops on error", async () => {
  const client = mockClient();
  client.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await sendChunks({
    client: client as never,
    chunks: [{ text: "fail" }, { text: "skipped" }],
    ignoreErrors: true,
    chatId: 123,
    threadId: undefined,
  });
  expect(consola.error).toHaveBeenCalledWith(expect.any(Error));
  expect(client.api.sendMessage).toHaveBeenCalledTimes(1);
});

test("throws when ignoreErrors is false", async () => {
  const client = mockClient();
  client.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await expect(
    sendChunks({
      client: client as never,
      chunks: [{ text: "fail" }],
      ignoreErrors: false,
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("network error");
});

test("ignoreErrors catches fallback failure too", async () => {
  const client = mockClient();
  client.api.sendMessage
    .mockRejectedValueOnce(new Error("markdown error"))
    .mockRejectedValueOnce(new Error("fallback error"));
  await sendChunks({
    client: client as never,
    chunks: [{ text: "hello", markdown: "*hello*" }],
    ignoreErrors: true,
    chatId: 123,
    threadId: undefined,
  });
  expect(consola.error).toHaveBeenCalledWith(expect.any(Error));
});
