import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";

function deferred() {
  return Promise.withResolvers<void>();
}

function stalledStream(events: readonly unknown[]) {
  let index = 0;
  let closed = false;
  let resolveNext: ((value: IteratorResult<unknown>) => void) | undefined;
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (closed) {
          return Promise.resolve({ done: true, value: undefined });
        }
        if (index < events.length) {
          const value = events[index];
          index += 1;
          return Promise.resolve({ done: false, value });
        }
        return new Promise<IteratorResult<unknown>>((resolve) => {
          resolveNext = resolve;
        });
      },
      return: () => {
        closed = true;
        resolveNext?.({ done: true, value: undefined });
        return Promise.resolve({ done: true, value: undefined });
      },
    }),
  };
}

test("logs closed after the stream loop exits", async () => {
  const onEvent = vi.fn(() => {
    dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {
          yield { directory: "/tmp/a", payload: { type: "a" } };
        })(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.closed;
  expect(logger.info).toHaveBeenCalledWith("OpenCode event stream is closed");
});

test("calls onEvent for each event", async () => {
  const events = [{ type: "a" }, { type: "b" }];
  const received: unknown[] = [];
  const onEvent = vi.fn((event: unknown) => {
    received.push(event);
    if (received.length === events.length) dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {
          for (const event of events)
            yield { directory: "/tmp/a", payload: event };
        })(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.closed;
  expect(received).toEqual([
    { directory: "/tmp/a", payload: events[0] },
    { directory: "/tmp/a", payload: events[1] },
  ]);
});

test("passes through event without normalizing directory", async () => {
  const onEvent = vi.fn(() => {
    dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {
          yield { payload: { type: "server.connected", properties: {} } };
        })(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.closed;
  expect(onEvent).toHaveBeenCalledWith(
    { payload: { type: "server.connected", properties: {} } },
    expect.any(AbortSignal),
  );
});

test("stops on dispose while subscribe is pending", async () => {
  let subscribeResolve: (() => void) | undefined;
  const opencodeClient = {
    global: {
      event: vi.fn(
        () =>
          new Promise<{ stream: AsyncIterable<unknown> }>((resolve) => {
            subscribeResolve = () =>
              resolve({ stream: (async function* () {})() });
          }),
      ),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn() as never,
  );

  expect(opencodeClient.global.event).toHaveBeenCalledOnce();
  subscribeResolve?.();
  await subscription[Symbol.asyncDispose]();
});

test("throws when subscribe fails", async () => {
  const opencodeClient = {
    global: {
      event: vi.fn(async () => {
        throw new Error("disconnect");
      }),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn() as never,
  );

  await expect(subscription.closed).rejects.toThrow("disconnect");
  await subscription[Symbol.asyncDispose]();
});

test("throws when the stream ends unexpectedly", async () => {
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {})(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn() as never,
  );

  await expect(subscription.closed).rejects.toThrow(
    "OpenCode event stream ended unexpectedly",
  );
  await subscription[Symbol.asyncDispose]();
});

test("throws when onEvent fails", async () => {
  const error = new Error("handler failed");
  const event = { directory: "/tmp/a", payload: { type: "a" } };
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream([event]),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn(async () => {
      throw error;
    }) as never,
  );

  await expect(subscription.closed).rejects.toBe(error);
  expect(logger.fatal).toHaveBeenCalledWith(
    "Failed to process event from OpenCode",
    error,
    { event },
  );
  await subscription[Symbol.asyncDispose]();
});

test("ignores handler rejection after dispose", async () => {
  const handler = Promise.withResolvers<void>();
  const event = { directory: "/tmp/a", payload: { type: "a" } };
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream([event]),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn(() => handler.promise) as never,
  );

  await Bun.sleep(10);
  const dispose = subscription[Symbol.asyncDispose]();
  handler.reject(new Error("late failure"));
  await dispose;

  expect(logger.fatal).not.toHaveBeenCalledWith(
    "Failed to process event from OpenCode",
    expect.any(Error),
    { event },
  );
});

test("logs connecting and connected", async () => {
  const onEvent = vi.fn(() => {
    dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {
          yield { directory: "/tmp/a", payload: { type: "a" } };
        })(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.closed;
  expect(logger.debug).toHaveBeenCalledWith(
    "OpenCode event stream is connecting…",
  );
  expect(logger.info).toHaveBeenCalledWith(
    "OpenCode event stream is connected",
  );
});

test("closed resolves when disposed mid-stream", async () => {
  let resolveNext: ((value: IteratorResult<unknown>) => void) | undefined;
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: {
          [Symbol.asyncIterator]: () => ({
            next: () =>
              new Promise<IteratorResult<unknown>>((resolve) => {
                resolveNext = resolve;
              }),
            return: () => {
              resolveNext?.({ done: true, value: undefined });
            },
          }),
        },
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn() as never,
  );

  while (vi.mocked(logger.info).mock.calls.length < 1) await Bun.sleep(1);

  await subscription[Symbol.asyncDispose]();
});

test("swallows iter.return rejection on dispose", async () => {
  let resolveNext: ((value: IteratorResult<unknown>) => void) | undefined;
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: {
          [Symbol.asyncIterator]: () => ({
            next: () =>
              new Promise<IteratorResult<unknown>>((resolve) => {
                resolveNext = resolve;
              }),
            return: () => {
              resolveNext?.({ done: true, value: undefined });
              return Promise.reject(new Error("return failed"));
            },
          }),
        },
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn() as never,
  );

  while (vi.mocked(logger.info).mock.calls.length < 1) await Bun.sleep(1);

  await subscription[Symbol.asyncDispose]();
});

test("passes signal to subscribe", async () => {
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: (async function* () {
          yield { directory: "/tmp/a", payload: { type: "a" } };
        })(),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    vi.fn(() => {
      dispose();
    }) as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.closed;
  expect(opencodeClient.global.event).toHaveBeenCalledWith(
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("processes events from the same session sequentially", async () => {
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;
  let dispose = () => {};
  const onEvent = vi.fn(async (event: { payload: { type: string } }) => {
    if (event.payload.type === "session.status") {
      firstStarted.resolve();
      await firstReleased.promise;
      return;
    }
    secondDidStart = true;
    secondStarted.resolve();
    dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream([
          {
            directory: "/tmp/a",
            payload: {
              type: "session.status",
              properties: {
                sessionID: "s1",
                status: { type: "busy" as const },
              },
            },
          },
          {
            directory: "/tmp/a",
            payload: {
              type: "message.removed",
              properties: { sessionID: "s1", messageID: "m1" },
            },
          },
        ]),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  dispose = () => {
    void subscription[Symbol.asyncDispose]();
  };

  await firstStarted.promise;
  expect(onEvent).toHaveBeenCalledTimes(1);
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
  await subscription.closed;
});

test("processes different sessions concurrently", async () => {
  const firstStarted = deferred();
  const secondStarted = deferred();
  const releaseBoth = deferred();
  let dispose = () => {};
  const onEvent = vi.fn(async (event: { payload: { type: string } }) => {
    if (event.payload.type === "session.status") firstStarted.resolve();
    else {
      secondStarted.resolve();
      dispose();
    }
    await releaseBoth.promise;
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream([
          {
            directory: "/tmp/a",
            payload: {
              type: "session.status",
              properties: {
                sessionID: "s1",
                status: { type: "busy" as const },
              },
            },
          },
          {
            directory: "/tmp/a",
            payload: {
              type: "message.removed",
              properties: { sessionID: "s2", messageID: "m1" },
            },
          },
        ]),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  dispose = () => {
    void subscription[Symbol.asyncDispose]();
  };

  await firstStarted.promise;
  await secondStarted.promise;
  releaseBoth.resolve();
  await subscription.closed;
});

test("processes unknown events through the default queue sequentially", async () => {
  const firstStarted = deferred();
  const firstReleased = deferred();
  const secondStarted = deferred();
  let secondDidStart = false;
  let dispose = () => {};
  const onEvent = vi.fn(async (event: { payload: { type: string } }) => {
    if (event.payload.type === "server.connected") {
      firstStarted.resolve();
      await firstReleased.promise;
      return;
    }
    secondDidStart = true;
    secondStarted.resolve();
    dispose();
  });
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream([
          {
            directory: "/tmp/a",
            payload: { type: "server.connected", properties: {} },
          },
          {
            directory: "/tmp/a",
            payload: { type: "installation.updated", properties: {} },
          },
        ]),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  dispose = () => {
    void subscription[Symbol.asyncDispose]();
  };

  await firstStarted.promise;
  expect(onEvent).toHaveBeenCalledTimes(1);
  await Bun.sleep(10);
  expect(secondDidStart).toBe(false);

  firstReleased.resolve();
  await secondStarted.promise;
  await subscription.closed;
});

test("routes all remaining event queue variants", async () => {
  const firstReleased = deferred();
  const handledTypes: string[] = [];
  const events = [
    {
      directory: "/tmp/a",
      payload: {
        type: "session.idle" as const,
        properties: { sessionID: "s1" },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.compacted" as const,
        properties: { sessionID: "s1" },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.diff" as const,
        properties: { sessionID: "s1", diff: [] },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "todo.updated" as const,
        properties: { sessionID: "s1", todos: [] },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "command.executed" as const,
        properties: {
          sessionID: "s1",
          name: "run",
          arguments: "",
          messageID: "m1",
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "question.asked" as const,
        properties: {
          id: "q1",
          sessionID: "s1",
          questions: [],
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "question.replied" as const,
        properties: {
          sessionID: "s1",
          requestID: "q1",
          answers: [["a"]],
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "question.rejected" as const,
        properties: {
          sessionID: "s1",
          requestID: "q1",
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "permission.asked" as const,
        properties: {
          id: "p1",
          sessionID: "s1",
          permission: "bash",
          patterns: [],
          metadata: {},
          always: [],
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "permission.replied" as const,
        properties: {
          sessionID: "s1",
          requestID: "p1",
          reply: "once" as const,
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "message.part.delta" as const,
        properties: {
          sessionID: "s1",
          messageID: "m1",
          partID: "p1",
          field: "text",
          delta: "hi",
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.error" as const,
        properties: { sessionID: "s1" },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.error" as const,
        properties: {},
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "message.updated" as const,
        properties: {
          info: {
            id: "m1",
            sessionID: "s1",
            role: "assistant" as const,
            time: { created: 1, completed: 2 },
            parentID: "m0",
            modelID: "model",
            providerID: "provider",
            mode: "chat",
            path: { cwd: "/tmp/a", root: "/tmp/a" },
            cost: 0,
            tokens: {
              input: 0,
              output: 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
          },
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "message.part.updated" as const,
        properties: {
          part: {
            id: "p1",
            sessionID: "s1",
            messageID: "m1",
            type: "text" as const,
            text: "hello",
          },
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.created" as const,
        properties: {
          info: {
            id: "s1",
            projectID: "p1",
            directory: "/tmp/a",
            title: "Session 1",
            version: "1",
            time: { created: 1, updated: 1 },
          },
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.updated" as const,
        properties: {
          info: {
            id: "s1",
            projectID: "p1",
            directory: "/tmp/a",
            title: "Session 1",
            version: "1",
            time: { created: 1, updated: 2 },
          },
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "session.deleted" as const,
        properties: {
          info: {
            id: "s1",
            projectID: "p1",
            directory: "/tmp/a",
            title: "Session 1",
            version: "1",
            time: { created: 1, updated: 3 },
          },
        },
      },
    },
    {
      directory: "/tmp/a",
      payload: {
        type: "installation.updated" as const,
        properties: { version: "1.0.0" },
      },
    },
  ];
  let dispose = () => {};
  const onEvent = vi.fn(
    async (event: { payload: { type: string } & Record<string, unknown> }) => {
      handledTypes.push(event.payload.type);
      if (event.payload.type === "session.idle") {
        await firstReleased.promise;
      }
      if (handledTypes.length === events.length) dispose();
    },
  );
  const opencodeClient = {
    global: {
      event: vi.fn(async () => ({
        stream: stalledStream(events),
      })),
    },
  };

  const subscription = OpencodeEventStream.create(
    opencodeClient as never,
    FloatingPromises.create(),
    onEvent as never,
  );
  dispose = () => {
    void subscription[Symbol.asyncDispose]();
  };

  await Bun.sleep(10);
  firstReleased.resolve();
  await subscription.closed;
  expect(handledTypes).toHaveLength(events.length);
});
