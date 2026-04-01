import { expect, test, vi } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";

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
    vi.fn(async () => {
      throw error;
    }) as never,
  );

  await expect(subscription.closed).rejects.toBe(error);
  await subscription[Symbol.asyncDispose]();
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
