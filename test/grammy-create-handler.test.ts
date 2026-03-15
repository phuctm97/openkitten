import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { grammyCreateHandler } from "~/lib/grammy-create-handler";
import * as grammySendErrorModule from "~/lib/grammy-send-error";

function mockCtx(chatId: number, threadId?: number, updateId = 1) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    update: { update_id: updateId },
  } as never;
}

test("calls callback", () => {
  const callback = vi.fn().mockResolvedValue(undefined);
  const handler = grammyCreateHandler({} as never, callback);
  const ctx = mockCtx(1);

  handler(ctx);

  expect(callback).toHaveBeenCalledWith(ctx);
});

test("catches error and sends to chat", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  const error = new Error("boom");
  const callback = vi.fn().mockRejectedValue(error);
  vi.spyOn(grammySendErrorModule, "grammySendError").mockImplementation(
    async () => {
      resolve();
    },
  );
  const bot = {} as never;
  const handler = grammyCreateHandler(bot, callback);

  handler(mockCtx(42, 7));
  await promise;

  expect(grammySendErrorModule.grammySendError).toHaveBeenCalledWith({
    bot,
    error,
    ignoreErrors: true,
    chatId: 42,
    threadId: 7,
  });
});

test("logs error with chat context", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  const error = new Error("fail");
  const callback = vi.fn().mockRejectedValue(error);
  vi.spyOn(grammySendErrorModule, "grammySendError").mockImplementation(
    async () => {
      resolve();
    },
  );
  const handler = grammyCreateHandler({} as never, callback);

  handler(mockCtx(1));
  await promise;

  expect(consola.error).toHaveBeenCalledWith(
    "Failed to process update from Telegram",
    { error, chatId: 1, threadId: undefined, updateId: 1 },
  );
});

test("passes undefined threadId when msg has none", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  const error = new Error("fail");
  const callback = vi.fn().mockRejectedValue(error);
  vi.spyOn(grammySendErrorModule, "grammySendError").mockImplementation(
    async () => {
      resolve();
    },
  );
  const handler = grammyCreateHandler({} as never, callback);

  handler(mockCtx(10));
  await promise;

  expect(grammySendErrorModule.grammySendError).toHaveBeenCalledWith(
    expect.objectContaining({ threadId: undefined }),
  );
});

test("logs fatal and skips callback when chat is missing", () => {
  const callback = vi.fn();
  const handler = grammyCreateHandler({} as never, callback);
  const ctx = {
    chat: undefined,
    msg: undefined,
    update: { update_id: 42 },
  } as never;

  handler(ctx);

  expect(consola.fatal).toHaveBeenCalledWith(
    "grammY received a non-chat update",
    { updateId: 42 },
  );
  expect(callback).not.toHaveBeenCalled();
});
