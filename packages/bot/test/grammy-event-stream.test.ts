import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
import { logger } from "~/lib/logger";

function deferred() {
  return Promise.withResolvers<void>();
}

function mockShutdown() {
  return { trigger: vi.fn() };
}

function mockMessageCtx(updateId: number, chatId: number, threadId?: number) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    update: { update_id: updateId },
  } as never;
}

function mockCallbackCtx(
  updateId: number,
  chatId: number,
  callbackQueryId: string,
  threadId?: number,
) {
  return {
    callbackQuery: {
      id: callbackQueryId,
      data: "cb:data",
      message: {
        chat: { id: chatId },
        message_thread_id: threadId,
      },
    },
    update: { update_id: updateId },
  } as never;
}

function mockUpdateCtx(updateId: number) {
  return { update: { update_id: updateId } } as never;
}

test("calls onEvent for an update", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const onEvent = vi.fn().mockResolvedValue(undefined);

  await grammyEventStream.enqueue(mockMessageCtx(1, 42), onEvent);

  expect(onEvent).toHaveBeenCalledOnce();
});

test("processes updates from the same chat and topic sequentially", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  void grammyEventStream.enqueue(mockMessageCtx(1, 42, 7), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  void grammyEventStream.enqueue(mockMessageCtx(2, 42, 7), async () => {
    secondDidStart = true;
    secondStarted.resolve();
  });

  await firstStarted.promise;
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
});

test("uses the fallback queue when chat and topic are missing", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  void grammyEventStream.enqueue(mockUpdateCtx(1), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  void grammyEventStream.enqueue(mockUpdateCtx(2), async () => {
    secondDidStart = true;
    secondStarted.resolve();
  });

  await firstStarted.promise;
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
});

test("processes updates from different chats concurrently", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const secondStarted = deferred();
  const releaseBoth = deferred();

  void grammyEventStream.enqueue(mockMessageCtx(1, 42), async () => {
    firstStarted.resolve();
    await releaseBoth.promise;
  });
  void grammyEventStream.enqueue(mockMessageCtx(2, 99), async () => {
    secondStarted.resolve();
    await releaseBoth.promise;
  });

  await firstStarted.promise;
  await secondStarted.promise;
  releaseBoth.resolve();
});

test("processes updates from different topics concurrently", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const secondStarted = deferred();
  const releaseBoth = deferred();

  void grammyEventStream.enqueue(mockMessageCtx(1, 42, 1), async () => {
    firstStarted.resolve();
    await releaseBoth.promise;
  });
  void grammyEventStream.enqueue(mockMessageCtx(2, 42, 2), async () => {
    secondStarted.resolve();
    await releaseBoth.promise;
  });

  await firstStarted.promise;
  await secondStarted.promise;
  releaseBoth.resolve();
});

test("uses callback query message chat and topic for queueing", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  void grammyEventStream.enqueue(mockMessageCtx(1, 42, 7), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  void grammyEventStream.enqueue(mockCallbackCtx(2, 42, "cb1", 7), async () => {
    secondDidStart = true;
    secondStarted.resolve();
  });

  await firstStarted.promise;
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
});

test("logs fatal and triggers shutdown when a handler rejects", async () => {
  await using floatingPromises = FloatingPromises.create();
  const shutdown = mockShutdown();
  await using grammyEventStream = GrammyEventStream.create(
    shutdown as never,
    floatingPromises,
  );
  const error = new Error("handler failed");
  const ctx = mockMessageCtx(42, 123);

  void grammyEventStream.enqueue(ctx, async () => {
    throw error;
  });

  await vi.waitFor(() =>
    expect(logger.fatal).toHaveBeenCalledWith(
      "Failed to process update from Telegram",
      error,
      { update: { update_id: 42 } },
    ),
  );
  expect(shutdown.trigger).toHaveBeenCalledOnce();
});

test("ignores handler rejection after dispose", async () => {
  await using floatingPromises = FloatingPromises.create();
  const shutdown = mockShutdown();
  const handler = Promise.withResolvers<void>();
  const ctx = mockMessageCtx(42, 123);
  const grammyEventStream = GrammyEventStream.create(
    shutdown as never,
    floatingPromises,
  );

  void grammyEventStream.enqueue(ctx, () => handler.promise);

  await Bun.sleep(10);
  const dispose = grammyEventStream[Symbol.asyncDispose]();
  handler.reject(new Error("late failure"));
  await dispose;

  expect(logger.fatal).not.toHaveBeenCalledWith(
    "Failed to process update from Telegram",
    expect.any(Error),
    { update: { update_id: 42 } },
  );
  expect(shutdown.trigger).not.toHaveBeenCalled();
});

test("does not start queued handlers after dispose", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const firstStarted = deferred();
  const firstReleased = deferred();
  let secondDidStart = false;

  void grammyEventStream.enqueue(mockMessageCtx(1, 42), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  void grammyEventStream.enqueue(mockMessageCtx(2, 42), async () => {
    secondDidStart = true;
  });

  await firstStarted.promise;
  const dispose = grammyEventStream[Symbol.asyncDispose]();
  firstReleased.resolve();
  await dispose;

  expect(secondDidStart).toBe(false);
});

test("waits for in-flight handlers before disposing", async () => {
  await using floatingPromises = FloatingPromises.create();
  const grammyEventStream = GrammyEventStream.create(
    mockShutdown() as never,
    floatingPromises,
  );
  const started = deferred();
  const release = deferred();

  void grammyEventStream.enqueue(mockMessageCtx(1, 42), async () => {
    started.resolve();
    await release.promise;
  });

  await started.promise;
  const dispose = grammyEventStream[Symbol.asyncDispose]();
  const disposeState = await Promise.race([
    dispose.then(() => "settled"),
    Bun.sleep(10).then(() => "pending"),
  ]);
  expect(disposeState).toBe("pending");

  release.resolve();
  await dispose;
});
