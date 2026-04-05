import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ExistingSessions } from "~/lib/existing-sessions";
import { logger } from "~/lib/logger";
import type { PendingPrompts } from "~/lib/pending-prompts";
import { TypingIndicators } from "~/lib/typing-indicators";
import type { WorkingSessions } from "~/lib/working-sessions";

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSendChatAction: MockFn;

function createMockBot() {
  return {
    api: {
      sendChatAction: (...args: unknown[]) => mockSendChatAction(...args),
    },
  } as never;
}

function createMockExistingSessions(
  map: Record<string, ExistingSessions.Location> = {},
) {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    check: (sessionId: string) => sessionId in map,
    get: (sessionId: string, options: ExistingSessions.GetOptions = {}) => {
      const location = map[sessionId];
      if (!location && options.unsafe) {
        throw new ExistingSessions.NotFoundError(sessionId);
      }
      return location;
    },
    hooks,
  } as unknown as ExistingSessions & { hooks: typeof hooks };
}

function createMockWorkingSessions(workingIds: Set<string> = new Set()) {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    check: (sessionId: string) => workingIds.has(sessionId),
    hooks,
    workingIds,
  } as unknown as WorkingSessions & {
    hooks: typeof hooks;
    workingIds: Set<string>;
  };
}

function createMockPendingPrompts(pendingIds: Set<string> = new Set()) {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    check: (sessionId: string) => pendingIds.has(sessionId),
    hooks,
    pendingIds,
  } as unknown as PendingPrompts & {
    hooks: typeof hooks;
    pendingIds: Set<string>;
  };
}

function createMockFloatingPromises() {
  return { track: vi.fn() };
}

function setup(
  esMap: Record<string, ExistingSessions.Location> = {},
  workingIds = new Set<string>(),
  pendingIds = new Set<string>(),
) {
  const shutdown = { trigger: vi.fn() };
  const bot = createMockBot();
  const es = createMockExistingSessions(esMap);
  const ws = createMockWorkingSessions(workingIds);
  const pp = createMockPendingPrompts(pendingIds);
  const fp = createMockFloatingPromises();
  const indicators = TypingIndicators.create(
    shutdown as never,
    bot,
    es,
    ws,
    pp,
    fp as never,
  );
  return { shutdown, es, ws, pp, fp, indicators };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSendChatAction = vi.fn(async () => {});
});

afterEach(() => {
  vi.useRealTimers();
});

test("starts with no active typing indicators", () => {
  const { indicators } = setup();
  expect(indicators.check("sess-1")).toBe(false);
});

test("working session change starts typing when no prompt is pending", async () => {
  const { ws, indicators } = setup({
    "sess-1": { chatId: 123, threadId: undefined },
  });
  ws.workingIds.add("sess-1");
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
  expect(indicators.check("sess-1")).toBe(true);
});

test("working session change does not start typing while prompt is pending", async () => {
  const { ws, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(),
    new Set(["sess-1"]),
  );
  ws.workingIds.add("sess-1");
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  expect(mockSendChatAction).not.toHaveBeenCalled();
  expect(indicators.check("sess-1")).toBe(false);
});

test("pending prompt cleared starts typing for working session", async () => {
  const { pp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
    new Set(["sess-1"]),
  );
  pp.pendingIds.delete("sess-1");
  await pp.hooks["change"]?.({ sessionId: "sess-1", pending: false });
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
  expect(indicators.check("sess-1")).toBe(true);
});

test("stops typing when session stops working", async () => {
  const { ws, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  ws.workingIds.delete("sess-1");
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: false });
  expect(indicators.check("sess-1")).toBe(false);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("stops typing when a prompt becomes pending", async () => {
  const { ws, pp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  pp.pendingIds.add("sess-1");
  await pp.hooks["change"]?.({ sessionId: "sess-1", pending: true });
  expect(indicators.check("sess-1")).toBe(false);
});

test("passes thread id when present", async () => {
  const { ws } = setup(
    { "sess-1": { chatId: 456, threadId: 789 } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  expect(mockSendChatAction).toHaveBeenCalledWith(456, "typing", {
    message_thread_id: 789,
  });
});

test("starting twice is idempotent", async () => {
  const { ws } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("start bubbles up initial send failures", async () => {
  mockSendChatAction = vi.fn(async () => {
    throw new Error("send failed");
  });
  const { ws } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await expect(
    ws.hooks["change"]?.({ sessionId: "sess-1", working: true }),
  ).rejects.toThrow("send failed");
});

test("sends typing action every four seconds while active", async () => {
  const { ws } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  await vi.advanceTimersByTimeAsync(8_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(3);
});

test("interval failures are tracked and trigger shutdown", async () => {
  const error = new Error("network error");
  let callCount = 0;
  mockSendChatAction = vi.fn(async () => {
    callCount++;
    if (callCount > 1) throw error;
  });
  const { shutdown, ws, fp } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  await vi.advanceTimersByTimeAsync(4_000);
  expect(fp.track).toHaveBeenCalledOnce();
  const tracked = (fp.track as MockFn).mock.calls[0]?.[0] as Promise<void>;
  await tracked;
  expect(logger.fatal).toHaveBeenCalledWith(
    "Failed to send typing indicator to Telegram",
    error,
    { sessionId: "sess-1" },
  );
  expect(shutdown.trigger).toHaveBeenCalled();
});

test("queued interval callback ignores removed sessions", async () => {
  let intervalCallback: (() => void) | undefined;
  const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
  setIntervalSpy.mockImplementation(((
    fn: Parameters<typeof setInterval>[0],
  ) => {
    if (typeof fn === "function") intervalCallback = fn;
    return 1 as unknown as Timer;
  }) as typeof setInterval);
  const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
  clearIntervalSpy.mockImplementation(() => {});
  const map: Record<string, ExistingSessions.Location> = {
    "sess-1": { chatId: 123, threadId: undefined },
  };
  const { es, ws, fp, shutdown } = setup(map, new Set(["sess-1"]));
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  delete map["sess-1"];

  intervalCallback?.();

  expect(fp.track).toHaveBeenCalledOnce();
  const tracked = (fp.track as MockFn).mock.calls[0]?.[0] as Promise<void>;
  await tracked;
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  expect(shutdown.trigger).not.toHaveBeenCalled();
  setIntervalSpy.mockRestore();
  clearIntervalSpy.mockRestore();
});

test("beforeRemove prevents further interval sends after typing has started", async () => {
  const map: Record<string, ExistingSessions.Location> = {
    "sess-1": { chatId: 123, threadId: undefined },
  };
  const { es, ws, indicators, shutdown } = setup(map, new Set(["sess-1"]));
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  delete map["sess-1"];
  await vi.advanceTimersByTimeAsync(4_000);
  expect(indicators.check("sess-1")).toBe(false);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  expect(shutdown.trigger).not.toHaveBeenCalled();
});

test("beforeRemove stops typing", async () => {
  const { es, ws, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(indicators.check("sess-1")).toBe(false);
});

test("beforeRemove during initial send prevents the interval from starting", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  mockSendChatAction = vi.fn(async () => {
    await promise;
  });
  const { es, ws, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  const startPromise = ws.hooks["change"]?.({
    sessionId: "sess-1",
    working: true,
  });
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  resolve();
  await startPromise;
  expect(indicators.check("sess-1")).toBe(false);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("dispose unhooks and clears active timers", async () => {
  const { es, ws, pp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  indicators[Symbol.dispose]();
  expect(es.hooks["beforeRemove"]).toBeUndefined();
  expect(ws.hooks["change"]).toBeUndefined();
  expect(pp.hooks["change"]).toBeUndefined();
  const countAfterDispose = mockSendChatAction.mock.calls.length;
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(countAfterDispose);
});
