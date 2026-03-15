import { consola } from "consola";
import { afterEach, expect, test, vi } from "vitest";
import { opencodeStream } from "~/lib/opencode-stream";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockSleep() {
  return vi.spyOn(Bun, "sleep").mockResolvedValue(undefined as never);
}

test("logs stop after loop exits", async () => {
  const onEvent = vi.fn(() => {
    dispose();
  });
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(consola.info).toHaveBeenCalledWith("OpenCode event stream is closed");
});

test("calls onEvent for each event", async () => {
  const events = [{ type: "a" }, { type: "b" }];
  const received: unknown[] = [];
  const onEvent = vi.fn((event: unknown) => {
    received.push(event);
    if (received.length === events.length) dispose();
  });
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          for (const e of events) yield e;
        })(),
      })),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(received).toEqual(events);
});

test("reconnects on stream error", async () => {
  mockSleep();
  const event = { type: "ok" };
  const onEvent = vi.fn(() => {
    dispose();
  });
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error("disconnect");
        return {
          stream: (async function* () {
            yield event;
          })(),
        };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(calls).toBe(2);
  expect(onEvent).toHaveBeenCalledWith(event);
});

test("stops on dispose", async () => {
  let subscribeResolve: (() => void) | undefined;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(
        () =>
          new Promise<{ stream: AsyncIterable<unknown> }>((resolve) => {
            subscribeResolve = () =>
              resolve({ stream: (async function* () {})() });
          }),
      ),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );

  expect(opencodeClient.event.subscribe).toHaveBeenCalledOnce();
  // Dispose aborts the signal, which cancels the pending subscribe call.
  // run() checks signal.aborted and breaks out of the loop.
  subscribeResolve?.();
  await subscription[Symbol.asyncDispose]();
});

test("throws after max reconnect attempts", async () => {
  mockSleep();
  const error = new Error("persistent failure");
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        throw error;
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );

  await expect(subscription.ended).rejects.toThrow("persistent failure");
  expect(opencodeClient.event.subscribe).toHaveBeenCalledTimes(11);
  await subscription[Symbol.asyncDispose]();
});

test("resets attempt counter on success", async () => {
  const sleep = mockSleep();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error("fail");
        if (calls === 2) {
          return {
            stream: (async function* () {
              yield { type: "a" };
            })(),
          };
        }
        if (calls === 3) throw new Error("fail");
        dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(calls).toBe(4);
  expect(sleep).toHaveBeenNthCalledWith(1, 1000);
  expect(sleep).toHaveBeenNthCalledWith(2, 1000);
});

test("uses exponential backoff", async () => {
  const sleep = mockSleep();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls <= 3) throw new Error("fail");
        dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(sleep).toHaveBeenNthCalledWith(1, 1000);
  expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  expect(sleep).toHaveBeenNthCalledWith(3, 4000);
});

test("caps backoff at 30 seconds", async () => {
  const sleep = mockSleep();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls <= 6) throw new Error("fail");
        dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(sleep).toHaveBeenNthCalledWith(5, 16_000);
  expect(sleep).toHaveBeenNthCalledWith(6, 30_000);
});

test("logs connecting and connected", async () => {
  const onEvent = vi.fn(() => {
    dispose();
  });
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(consola.start).toHaveBeenCalledWith(
    "OpenCode event stream is connecting…",
  );
  expect(consola.ready).toHaveBeenCalledWith(
    "OpenCode event stream is connected",
  );
});

test("logs reconnection", async () => {
  mockSleep();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error("fail");
        dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(consola.warn).toHaveBeenCalledWith(
    "OpenCode event stream is disconnected, reconnecting…",
    { attempt: 0, delay: 1000 },
  );
});

test("ended resolves when disposed mid-stream", async () => {
  let resolveNext: ((v: IteratorResult<unknown>) => void) | undefined;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: {
          [Symbol.asyncIterator]: () => ({
            next: () =>
              new Promise<IteratorResult<unknown>>((r) => {
                resolveNext = r;
              }),
            return: () => {
              resolveNext?.({ done: true, value: undefined });
            },
          }),
        },
      })),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );

  // Wait for stream to connect.
  const readyMock = vi.mocked(consola.ready);
  while (readyMock.mock.calls.length < 1) await Bun.sleep(1);

  await subscription[Symbol.asyncDispose]();
});

test("reconnects on normal stream end with backoff", async () => {
  const sleep = mockSleep();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 2) dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(calls).toBe(2);
  expect(sleep).toHaveBeenCalledWith(1000);
});

test("dispose interrupts backoff sleep", async () => {
  vi.spyOn(Bun, "sleep").mockReturnValue(new Promise<void>(() => {}));
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        throw new Error("fail");
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn() as never,
  );

  const warnMock = vi.mocked(consola.warn);
  while (warnMock.mock.calls.length < 1)
    await new Promise((r) => setTimeout(r, 1));

  await subscription[Symbol.asyncDispose]();
  expect(calls).toBe(1);
});

test("passes signal to subscribe", async () => {
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    vi.fn() as never,
    vi.fn(() => {
      dispose();
    }) as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(opencodeClient.event.subscribe).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("calls onRestart on each connection", async () => {
  mockSleep();
  const onRestart = vi.fn();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 1) {
          return {
            stream: (async function* () {
              yield { type: "a" };
            })(),
          };
        }
        dispose();
        return { stream: (async function* () {})() };
      }),
    },
  };

  const subscription = opencodeStream(
    opencodeClient as never,
    onRestart as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(onRestart).toHaveBeenCalledTimes(2);
});

test("awaits async onRestart before consuming events", async () => {
  const order: string[] = [];
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  const onRestart = vi.fn(async () => {
    await Bun.sleep(1);
    order.push("restarted");
  });
  const onEvent = vi.fn(() => {
    order.push("event");
    dispose();
  });

  const subscription = opencodeStream(
    opencodeClient as never,
    onRestart as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(order).toEqual(["restarted", "event"]);
});
