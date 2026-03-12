import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import { sendChunks } from "~/lib/send-chunks";

function mockClient() {
  return { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
}

let client: ReturnType<typeof mockClient>;

beforeEach(() => {
  client = mockClient();
});

function send(
  chunks: Array<{ text: string; markdown?: string }>,
  options?: { readonly ignoreErrors?: boolean; readonly threadId?: number },
) {
  return sendChunks({
    client: client as never,
    chunks,
    chatId: 123,
    ignoreErrors: options?.ignoreErrors ?? false,
    threadId: options?.threadId,
  });
}

test("sends plain text chunk", async () => {
  await send([{ text: "hello" }]);
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("sends MarkdownV2 chunk", async () => {
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "*hello*", {
    parse_mode: "MarkdownV2",
  });
});

test("falls back to plain text when MarkdownV2 fails", async () => {
  client.api.sendMessage
    .mockRejectedValueOnce(new Error("parse error"))
    .mockResolvedValueOnce(undefined);
  await send([{ text: "hello", markdown: "*hello*" }]);
  expect(consola.debug).toHaveBeenCalledWith(
    "failed to send MarkdownV2 message, falling back to plain text",
    { error: expect.any(Error), markdown: "*hello*", text: "hello" },
  );
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {});
});

test("includes thread id in send options", async () => {
  await send([{ text: "hello" }], { threadId: 456 });
  expect(client.api.sendMessage).toHaveBeenCalledWith(123, "hello", {
    message_thread_id: 456,
  });
});

test("sends multiple chunks in order", async () => {
  const calls: string[] = [];
  client.api.sendMessage.mockImplementation((_chatId: number, text: string) => {
    calls.push(text);
    return Promise.resolve(undefined);
  });
  await send([{ text: "first" }, { text: "second" }, { text: "third" }]);
  expect(calls).toEqual(["first", "second", "third"]);
});

test("ignoreErrors logs and stops on error", async () => {
  client.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await send([{ text: "fail" }, { text: "skipped" }], { ignoreErrors: true });
  expect(consola.error).toHaveBeenCalledWith(expect.any(Error));
  expect(client.api.sendMessage).toHaveBeenCalledTimes(1);
});

test("throws when ignoreErrors is false", async () => {
  client.api.sendMessage.mockRejectedValueOnce(new Error("network error"));
  await expect(send([{ text: "fail" }])).rejects.toThrow("network error");
});

test("ignoreErrors catches fallback failure too", async () => {
  client.api.sendMessage
    .mockRejectedValueOnce(new Error("markdown error"))
    .mockRejectedValueOnce(new Error("fallback error"));
  await send([{ text: "hello", markdown: "*hello*" }], { ignoreErrors: true });
  expect(consola.error).toHaveBeenCalledWith(expect.any(Error));
});
