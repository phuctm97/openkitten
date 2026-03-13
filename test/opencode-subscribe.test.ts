import { consola } from "consola";
import { afterEach, expect, test, vi } from "vitest";
import { opencodeSubscribe } from "~/lib/opencode-subscribe";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockSleep() {
  return vi.spyOn(Bun, "sleep").mockResolvedValue(undefined as never);
}

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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(received).toEqual(events);
});

test("reconnects on stream error", async () => {
  mockSleep();
  const event = { type: "ok" };
  const onEvent = vi.fn(() => dispose());
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    vi.fn() as never,
  );

  expect(opencodeClient.event.subscribe).toHaveBeenCalledOnce();
  // Dispose triggers abort; the subscribe call is still pending but
  // run() checks signal.aborted after the catch and returns.
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(sleep).toHaveBeenNthCalledWith(5, 16_000);
  expect(sleep).toHaveBeenNthCalledWith(6, 30_000);
});

test("logs connecting and connected", async () => {
  const onEvent = vi.fn(() => dispose());
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    onEvent as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(consola.debug).toHaveBeenCalledWith(
    "opencode event stream is connecting",
  );
  expect(consola.debug).toHaveBeenCalledWith(
    "opencode event stream is connected",
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(consola.warn).toHaveBeenCalledWith(
    "opencode event stream disconnected, reconnecting",
    { attempt: 0, delay: "1000ms" },
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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    vi.fn() as never,
  );

  // Wait for stream to connect.
  const debugMock = vi.mocked(consola.debug);
  while (debugMock.mock.calls.length < 2) await Bun.sleep(1);

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

  const subscription = opencodeSubscribe(
    opencodeClient as never,
    vi.fn() as never,
  );
  const dispose = () => subscription[Symbol.asyncDispose]();

  await subscription.ended;
  expect(calls).toBe(2);
  expect(sleep).toHaveBeenCalledWith(1000);
});
