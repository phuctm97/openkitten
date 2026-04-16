import type { Context } from "grammy";
import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { GrammyEventLoop } from "~/lib/grammy-event-loop";
import type { Scope } from "~/lib/scope";

function deferred() {
  return Promise.withResolvers<void>();
}

function mockScope(): Scope {
  return {
    floatingPromises: {} as never,
    shutdown: { signal: new AbortController().signal } as never,
  } as never;
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

function queueEvent(
  grammyEventLoop: GrammyEventLoop,
  ctx: Context,
  onEvent: () => void | Promise<void>,
) {
  grammyEventLoop.connect(mockScope(), async () => {
    await onEvent();
  })(ctx);
}

test("calls onEvent for an update", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const onEvent = vi.fn().mockResolvedValue(undefined);

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), onEvent);

  await vi.waitFor(() => expect(onEvent).toHaveBeenCalledOnce());
});

test("connect calls fn with scope, ctx, and shutdown signal", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const scope = mockScope();
  const fn = vi.fn().mockResolvedValue(undefined);
  const ctx = mockMessageCtx(1, 42);
  const handler = grammyEventLoop.connect(scope, fn);

  handler(ctx);

  await vi.waitFor(() =>
    expect(fn).toHaveBeenCalledWith(scope, ctx, scope.shutdown.signal),
  );
});

test("processes updates from the same chat and topic sequentially", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42, 7), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  queueEvent(grammyEventLoop, mockMessageCtx(2, 42, 7), async () => {
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
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  queueEvent(grammyEventLoop, mockUpdateCtx(1), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  queueEvent(grammyEventLoop, mockUpdateCtx(2), async () => {
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
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const secondStarted = deferred();
  const releaseBoth = deferred();

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), async () => {
    firstStarted.resolve();
    await releaseBoth.promise;
  });
  queueEvent(grammyEventLoop, mockMessageCtx(2, 99), async () => {
    secondStarted.resolve();
    await releaseBoth.promise;
  });

  await firstStarted.promise;
  await secondStarted.promise;
  releaseBoth.resolve();
});

test("processes updates from different topics concurrently", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const secondStarted = deferred();
  const releaseBoth = deferred();

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42, 1), async () => {
    firstStarted.resolve();
    await releaseBoth.promise;
  });
  queueEvent(grammyEventLoop, mockMessageCtx(2, 42, 2), async () => {
    secondStarted.resolve();
    await releaseBoth.promise;
  });

  await firstStarted.promise;
  await secondStarted.promise;
  releaseBoth.resolve();
});

test("uses callback query message chat and topic for queueing", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42, 7), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  queueEvent(grammyEventLoop, mockCallbackCtx(2, 42, "cb1", 7), async () => {
    secondDidStart = true;
    secondStarted.resolve();
  });

  await firstStarted.promise;
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
});

test("rejects ended when a handler rejects", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const error = new Error("handler failed");
  const ctx = mockMessageCtx(42, 123);

  queueEvent(grammyEventLoop, ctx, async () => {
    throw error;
  });

  await expect(grammyEventLoop.ended).rejects.toThrow("handler failed");
});

test("rejects ended when a handler rejects with undefined", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const ctx = mockMessageCtx(43, 123);

  queueEvent(grammyEventLoop, ctx, async () => {
    throw undefined;
  });

  await expect(grammyEventLoop.ended).rejects.toBeUndefined();
});

test("drops updates queued after dispose", async () => {
  await using floatingPromises = FloatingPromises.create();
  const grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const onEvent = vi.fn().mockResolvedValue(undefined);

  await grammyEventLoop[Symbol.asyncDispose]();
  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), onEvent);

  await Bun.sleep(10);
  expect(onEvent).not.toHaveBeenCalled();
  await expect(grammyEventLoop.ended).resolves.toBeUndefined();
});

test("ignores handler rejection after dispose", async () => {
  await using floatingPromises = FloatingPromises.create();
  const handler = Promise.withResolvers<void>();
  const ctx = mockMessageCtx(42, 123);
  const grammyEventLoop = GrammyEventLoop.create(floatingPromises);

  queueEvent(grammyEventLoop, ctx, () => handler.promise);

  await Bun.sleep(10);
  const dispose = grammyEventLoop[Symbol.asyncDispose]();
  handler.reject(new Error("late failure"));
  await dispose;
  await expect(grammyEventLoop.ended).resolves.toBeUndefined();
});

test("does not start queued handlers after dispose", async () => {
  await using floatingPromises = FloatingPromises.create();
  await using grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const firstReleased = deferred();
  let secondDidStart = false;

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  queueEvent(grammyEventLoop, mockMessageCtx(2, 42), async () => {
    secondDidStart = true;
  });

  await firstStarted.promise;
  const dispose = grammyEventLoop[Symbol.asyncDispose]();
  firstReleased.resolve();
  await dispose;

  expect(secondDidStart).toBe(false);
});

test("waits for in-flight handlers before disposing", async () => {
  await using floatingPromises = FloatingPromises.create();
  const grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const started = deferred();
  const release = deferred();

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), async () => {
    started.resolve();
    await release.promise;
  });

  await started.promise;
  const dispose = grammyEventLoop[Symbol.asyncDispose]();
  const disposeState = await Promise.race([
    dispose.then(() => "settled"),
    Bun.sleep(10).then(() => "pending"),
  ]);
  expect(disposeState).toBe("pending");

  release.resolve();
  await dispose;
});

test("waits for in-flight handlers before rejecting ended", async () => {
  await using floatingPromises = FloatingPromises.create();
  const grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  const error = new Error("handler failed");

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), async () => {
    firstStarted.resolve();
    await firstReleased.promise;
  });
  queueEvent(grammyEventLoop, mockMessageCtx(2, 99), async () => {
    secondStarted.resolve();
    throw error;
  });

  await firstStarted.promise;
  await secondStarted.promise;

  const endedState = await Promise.race([
    grammyEventLoop.ended.then(
      () => "resolved",
      () => "rejected",
    ),
    Bun.sleep(10).then(() => "pending"),
  ]);
  expect(endedState).toBe("pending");

  firstReleased.resolve();
  await expect(grammyEventLoop.ended).rejects.toThrow("handler failed");
});

test("drops updates queued after a handler failure", async () => {
  await using floatingPromises = FloatingPromises.create();
  const grammyEventLoop = GrammyEventLoop.create(floatingPromises);
  const onEvent = vi.fn().mockResolvedValue(undefined);

  queueEvent(grammyEventLoop, mockMessageCtx(1, 42), async () => {
    throw new Error("handler failed");
  });

  await expect(grammyEventLoop.ended).rejects.toThrow("handler failed");

  queueEvent(grammyEventLoop, mockMessageCtx(2, 42), onEvent);

  await Bun.sleep(10);
  expect(onEvent).not.toHaveBeenCalled();
});
