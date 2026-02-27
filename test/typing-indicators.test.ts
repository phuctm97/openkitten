import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
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
    sessionIds: Object.keys(map) as string[],
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    findOrCreate: vi.fn(),
    invalidate: vi.fn(),
    check: (sessionId: string) => sessionId in map,

    resolve: (sessionId: string) => {
      const loc = map[sessionId];
      if (!loc) throw new Error(`No session found: ${sessionId}`);
      return loc;
    },
    hooks,
  } as unknown as ExistingSessions & {
    sessionIds: string[];
    hooks: typeof hooks;
  };
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
  return { shutdown, bot, es, ws, pp, fp, indicators };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSendChatAction = vi.fn(async () => {});
});

afterEach(() => {
  vi.useRealTimers();
});

// --- check tests ---

test("starts with no sessions", () => {
  const { indicators } = setup();
  expect(indicators.check("sess-1")).toBe(false);
  expect(indicators.check("sess-1")).toBe(false);
});

test("exposes active session ids", async () => {
  const { es, indicators } = setup(
    {
      "sess-1": { chatId: 123, threadId: undefined },
      "sess-2": { chatId: 456, threadId: 789 },
    },
    new Set(["sess-1", "sess-2"]),
  );
  await indicators.invalidate();
  expect(indicators.check("sess-1")).toBe(true);
  expect(indicators.check("sess-2")).toBe(true);
  expect(indicators.check("sess-1")).toBe(true);
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(indicators.check("sess-2")).toBe(true);
  expect(indicators.check("sess-1")).toBe(false);
});

// --- invalidate tests ---

test("invalidate with no sessions skips processing", async () => {
  const { indicators } = setup();
  await indicators.invalidate();
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("starts typing when working with no pending prompts", async () => {
  const { indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("does not start typing when not working", async () => {
  const { indicators } = setup({
    "sess-1": { chatId: 123, threadId: undefined },
  });
  await indicators.invalidate();
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("does not start typing when pending prompts exist", async () => {
  const { indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("initial send error bubbles up", async () => {
  mockSendChatAction = vi.fn(async () => {
    throw new Error("send failed");
  });
  const { indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await expect(indicators.invalidate()).rejects.toThrow("send failed");
});

test("resolve error bubbles up when session not in existingSessions", async () => {
  const { es, indicators } = setup({}, new Set(["sess-1"]));
  es.sessionIds = ["sess-1"];
  await expect(indicators.invalidate()).rejects.toThrow("No session found");
});

test("is idempotent when already typing", async () => {
  const { indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("stops typing on invalidate when session stops working", async () => {
  const { indicators, ws } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  ws.workingIds.delete("sess-1");
  await indicators.invalidate();
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("disposes all active timers", async () => {
  const { indicators } = setup(
    {
      "sess-1": { chatId: 123, threadId: undefined },
      "sess-2": { chatId: 456, threadId: 789 },
    },
    new Set(["sess-1", "sess-2"]),
  );
  {
    using _ = indicators;
    await indicators.invalidate();
  }
  const countAfterDispose = mockSendChatAction.mock.calls.length;
  await vi.advanceTimersByTimeAsync(8_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(countAfterDispose);
});

test("sends typing action every 4 seconds", async () => {
  const { indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(3);
});

test("passes thread id when present", async () => {
  const { indicators } = setup(
    { "sess-2": { chatId: 456, threadId: 789 } },
    new Set(["sess-2"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledWith(456, "typing", {
    message_thread_id: 789,
  });
});

test("interval send error triggers fatal and shutdown", async () => {
  const error = new Error("network error");
  let callCount = 0;
  mockSendChatAction = vi.fn(async () => {
    callCount++;
    if (callCount > 1) throw error;
  });
  const { shutdown, fp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  // Capture the tracked promise from the interval
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

test("interval send tracks via floatingPromises", async () => {
  const { fp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  await vi.advanceTimersByTimeAsync(4_000);
  expect(fp.track).toHaveBeenCalledOnce();
});

// --- hook tests ---

test("beforeRemove hook stops typing for session", async () => {
  const { es, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(indicators.check("sess-1")).toBe(true);
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(indicators.check("sess-1")).toBe(false);
});

test("workingSessions change hook starts typing when session becomes working", async () => {
  const { ws, indicators } = setup({
    "sess-1": { chatId: 123, threadId: undefined },
  });
  ws.workingIds.add("sess-1");
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: true });
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
  expect(indicators.check("sess-1")).toBe(true);
});

test("workingSessions change hook stops typing when session stops working", async () => {
  const { ws, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(indicators.check("sess-1")).toBe(true);
  ws.workingIds.delete("sess-1");
  await ws.hooks["change"]?.({ sessionId: "sess-1", working: false });
  expect(indicators.check("sess-1")).toBe(false);
});

test("pendingPrompts change hook stops typing when prompts become pending", async () => {
  const { pp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(indicators.check("sess-1")).toBe(true);
  pp.pendingIds.add("sess-1");
  await pp.hooks["change"]?.({ sessionId: "sess-1", pending: true });
  expect(indicators.check("sess-1")).toBe(false);
});

test("pendingPrompts change hook starts typing when prompts cleared", async () => {
  const { pp, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
    new Set(["sess-1"]),
  );
  await indicators.invalidate();
  expect(mockSendChatAction).not.toHaveBeenCalled();
  pp.pendingIds.delete("sess-1");
  await pp.hooks["change"]?.({ sessionId: "sess-1", pending: false });
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("beforeRemove during initial send prevents interval from starting", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  mockSendChatAction = vi.fn(async () => {
    await promise;
  });
  const { es, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  const startPromise = indicators.invalidate();
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

test("beforeRemove before interval is set clears timer entry", async () => {
  const { resolve, promise } = Promise.withResolvers<void>();
  mockSendChatAction = vi.fn(async () => {
    await promise;
  });
  const { es, indicators } = setup(
    { "sess-1": { chatId: 123, threadId: undefined } },
    new Set(["sess-1"]),
  );
  const startPromise = indicators.invalidate();
  expect(indicators.check("sess-1")).toBe(true);
  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(indicators.check("sess-1")).toBe(false);
  resolve();
  await startPromise;
});

test("dispose unhooks all hooks", () => {
  const { es, ws, pp, indicators } = setup();
  indicators[Symbol.dispose]();
  expect(es.hooks["beforeRemove"]).toBeUndefined();
  expect(ws.hooks["change"]).toBeUndefined();
  expect(pp.hooks["change"]).toBeUndefined();
});
