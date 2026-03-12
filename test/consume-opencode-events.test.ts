import { consola } from "consola";
import { afterEach, expect, test, vi } from "vitest";
import { consumeOpencodeEvents } from "~/lib/consume-opencode-events";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockSleep() {
  return vi.spyOn(Bun, "sleep").mockResolvedValue(undefined as never);
}

test("consumeOpencodeEvents calls onEvent for each event", async () => {
  const events = [{ type: "a" }, { type: "b" }];
  const controller = new AbortController();
  const received: unknown[] = [];
  const onEvent = vi.fn((event: unknown) => {
    received.push(event);
    if (received.length === events.length) controller.abort();
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

  await consumeOpencodeEvents(
    opencodeClient as never,
    onEvent as never,
    controller.signal,
  );

  expect(received).toEqual(events);
});

test("consumeOpencodeEvents reconnects on stream error", async () => {
  mockSleep();
  const controller = new AbortController();
  const event = { type: "ok" };
  const onEvent = vi.fn(() => controller.abort());
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

  await consumeOpencodeEvents(
    opencodeClient as never,
    onEvent as never,
    controller.signal,
  );

  expect(calls).toBe(2);
  expect(onEvent).toHaveBeenCalledWith(event);
});

test("consumeOpencodeEvents stops when signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const opencodeClient = {
    event: { subscribe: vi.fn() },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(opencodeClient.event.subscribe).not.toHaveBeenCalled();
});

test("consumeOpencodeEvents throws after max reconnect attempts", async () => {
  mockSleep();
  const controller = new AbortController();
  const error = new Error("persistent failure");
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        throw error;
      }),
    },
  };

  await expect(
    consumeOpencodeEvents(
      opencodeClient as never,
      vi.fn() as never,
      controller.signal,
    ),
  ).rejects.toThrow("persistent failure");

  expect(opencodeClient.event.subscribe).toHaveBeenCalledTimes(11);
});

test("consumeOpencodeEvents resets attempt counter on success", async () => {
  const sleep = mockSleep();
  const controller = new AbortController();
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
        controller.abort();
        return { stream: (async function* () {})() };
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(calls).toBe(4);
  expect(sleep).toHaveBeenNthCalledWith(1, 1000);
  expect(sleep).toHaveBeenNthCalledWith(2, 1000);
});

test("consumeOpencodeEvents uses exponential backoff", async () => {
  const sleep = mockSleep();
  const controller = new AbortController();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls <= 3) throw new Error("fail");
        controller.abort();
        return { stream: (async function* () {})() };
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(sleep).toHaveBeenNthCalledWith(1, 1000);
  expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  expect(sleep).toHaveBeenNthCalledWith(3, 4000);
});

test("consumeOpencodeEvents caps backoff at 30 seconds", async () => {
  const sleep = mockSleep();
  const controller = new AbortController();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls <= 6) throw new Error("fail");
        controller.abort();
        return { stream: (async function* () {})() };
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(sleep).toHaveBeenNthCalledWith(5, 16_000);
  expect(sleep).toHaveBeenNthCalledWith(6, 30_000);
});

test("consumeOpencodeEvents logs connecting and connected", async () => {
  const controller = new AbortController();
  const onEvent = vi.fn(() => controller.abort());
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: "a" };
        })(),
      })),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    onEvent as never,
    controller.signal,
  );

  expect(consola.debug).toHaveBeenCalledWith(
    "opencode event stream is connecting",
  );
  expect(consola.debug).toHaveBeenCalledWith(
    "opencode event stream is connected",
  );
});

test("consumeOpencodeEvents logs reconnection", async () => {
  mockSleep();
  const controller = new AbortController();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error("fail");
        controller.abort();
        return { stream: (async function* () {})() };
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(consola.warn).toHaveBeenCalledWith(
    "opencode event stream disconnected, reconnecting",
    { attempt: 0, delay: "1000ms" },
  );
});

test("consumeOpencodeEvents returns silently when aborted during error", async () => {
  const controller = new AbortController();
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        controller.abort();
        throw new Error("fail");
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(opencodeClient.event.subscribe).toHaveBeenCalledOnce();
});

test("consumeOpencodeEvents reconnects on normal stream end with backoff", async () => {
  const sleep = mockSleep();
  const controller = new AbortController();
  let calls = 0;
  const opencodeClient = {
    event: {
      subscribe: vi.fn(async () => {
        calls++;
        if (calls === 2) controller.abort();
        return { stream: (async function* () {})() };
      }),
    },
  };

  await consumeOpencodeEvents(
    opencodeClient as never,
    vi.fn() as never,
    controller.signal,
  );

  expect(calls).toBe(2);
  expect(sleep).toHaveBeenCalledWith(1000);
});
