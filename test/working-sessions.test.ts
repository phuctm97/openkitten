import type { EventSessionStatus, SessionStatus } from "@opencode-ai/sdk/v2";
import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { WorkingSessions } from "~/lib/working-sessions";

function statusEvent(
  sessionID: string,
  status: SessionStatus,
): EventSessionStatus {
  return { type: "session.status", properties: { sessionID, status } };
}

function mockExistingSessions() {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    sessionIds: [] as string[],
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    find: vi.fn(),
    invalidate: vi.fn(),
    check: vi.fn(() => true),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 42,
      threadId: undefined,
    })),
    hooks,
  } as unknown as ExistingSessions & {
    sessionIds: string[];
    hooks: typeof hooks;
  };
}

function setup() {
  const sessionStatus = vi.fn(async () => ({ data: {} }));
  const opencodeClient = { session: { status: sessionStatus } };
  const existingSessions = mockExistingSessions();
  const working = WorkingSessions.create(
    opencodeClient as never,
    existingSessions,
  );
  return { existingSessions, working, sessionStatus };
}

test("starts with no sessions", () => {
  const { working } = setup();
  expect(working.check("sess-1")).toBe(false);
});

test("check returns true for working session", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
});

test("check returns false for non-working session", () => {
  const { working } = setup();
  expect(working.check("sess-1")).toBe(false);
});

test("marks session as working when status is busy", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
});

test("marks session as working when status is retry", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  sessionStatus.mockResolvedValue({
    data: { "sess-1": { type: "retry", attempt: 1, message: "", next: 0 } },
  });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
});

test("does not mark session as working when idle", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "idle" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(false);
});

test("does not mark session as working when status is missing", async () => {
  const { existingSessions, working } = setup();
  existingSessions.sessionIds = ["sess-1"];
  await working.invalidate();
  expect(working.check("sess-1")).toBe(false);
});

test("removes session when it becomes idle", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "idle" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(false);
});

test("tracks multiple sessions independently", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1", "sess-2"];
  sessionStatus.mockResolvedValue({
    data: { "sess-1": { type: "busy" }, "sess-2": { type: "idle" } },
  });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
  expect(working.check("sess-2")).toBe(false);
});

test("update marks session as working on busy event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(working.check("sess-1")).toBe(true);
});

test("update marks session as working on retry event", async () => {
  const { working } = setup();
  await working.update(
    statusEvent("sess-1", { type: "retry", attempt: 1, message: "", next: 0 }),
  );
  expect(working.check("sess-1")).toBe(true);
});

test("update does not mark session as working on idle event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
});

test("update removes a previously working session on idle event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(working.check("sess-1")).toBe(true);
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
});

test("update and invalidate work together consistently", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  await working.update(statusEvent("sess-1", { type: "busy" }));
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(working.check("sess-1")).toBe(true);
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
});

test("lock runs fn when session is not working", async () => {
  const { working } = setup();
  let called = false;
  await working.lock("sess-1", async () => {
    called = true;
  });
  expect(called).toBe(true);
});

test("lock passes sessionId to fn", async () => {
  const { working } = setup();
  let received: string | undefined;
  await working.lock("sess-1", async (sessionId) => {
    received = sessionId;
  });
  expect(received).toBe("sess-1");
});

test("lock throws LockedError when session is cached as working", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  await expect(working.lock("sess-1", async () => {})).rejects.toSatisfy(
    (error) =>
      error instanceof WorkingSessions.LockedError &&
      error.sessionId === "sess-1",
  );
});

test("lock does not include session in check during fn", async () => {
  const { working } = setup();
  let checkDuring = false;
  await working.lock("sess-1", async () => {
    checkDuring = working.check("sess-1");
  });
  expect(checkDuring).toBe(false);
  expect(working.check("sess-1")).toBe(false);
});

test("lock throws LockedError on concurrent lock of same session", async () => {
  const { working } = setup();
  const { promise, resolve } = Promise.withResolvers<void>();
  const first = working.lock("sess-1", async () => {
    await promise;
  });
  await expect(working.lock("sess-1", async () => {})).rejects.toBeInstanceOf(
    WorkingSessions.LockedError,
  );
  resolve();
  await first;
});

test("lock allows concurrent lock on different sessions", async () => {
  const { working } = setup();
  const { promise, resolve } = Promise.withResolvers<void>();
  const first = working.lock("sess-1", async () => {
    await promise;
  });
  let called = false;
  await working.lock("sess-2", async () => {
    called = true;
  });
  expect(called).toBe(true);
  resolve();
  await first;
});

test("lock clears locked state on fn error", async () => {
  const { working } = setup();
  await expect(
    working.lock("sess-1", async () => {
      throw new Error("fail");
    }),
  ).rejects.toThrow("fail");
  expect(working.check("sess-1")).toBe(false);
});

test("locked session throws LockedError on concurrent lock even though check returns false", async () => {
  const { working } = setup();
  const { promise, resolve } = Promise.withResolvers<void>();
  const locking = working.lock("sess-1", async () => {
    await promise;
  });
  expect(working.check("sess-1")).toBe(false);
  await expect(working.lock("sess-1", async () => {})).rejects.toBeInstanceOf(
    WorkingSessions.LockedError,
  );
  resolve();
  await locking;
});

test("beforeRemove does not affect locked state", async () => {
  const { existingSessions, working } = setup();
  const { promise, resolve } = Promise.withResolvers<void>();
  const locking = working.lock("sess-1", async () => {
    await promise;
  });
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(working.check("sess-1")).toBe(false);
  await expect(working.lock("sess-1", async () => {})).rejects.toBeInstanceOf(
    WorkingSessions.LockedError,
  );
  resolve();
  await locking;
});

test("invalidate with empty statuses is a no-op", async () => {
  const { working } = setup();
  await working.invalidate();
  expect(working.check("sess-1")).toBe(false);
});

// --- hook tests ---

test("beforeRemove hook releases session", async () => {
  const { existingSessions, working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(working.check("sess-1")).toBe(true);
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(working.check("sess-1")).toBe(false);
});

test("dispose unhooks beforeRemove", async () => {
  const { existingSessions, working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  working[Symbol.dispose]();
  existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(working.check("sess-1")).toBe(true);
});

// --- change hook tests ---

test("update fires change hook with working=true when session becomes busy", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(onChange).toHaveBeenCalledWith({ sessionId: "sess-1", working: true });
});

test("update fires change hook with working=false when session becomes idle", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    working: false,
  });
});

test("update does not fire change hook if state unchanged", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("update does not fire change hook if session not cached and idle", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("beforeRemove fires change hook with working=false for cached sessions", async () => {
  const { existingSessions, working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    working: false,
  });
});

test("beforeRemove does not fire change hook for uncached sessions", async () => {
  const { existingSessions, working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(onChange).not.toHaveBeenCalled();
});

test("invalidate fires change hook with working=true for new busy sessions", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  const onChange = vi.fn();
  working.hook("change", onChange);
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(onChange).toHaveBeenCalledWith({ sessionId: "sess-1", working: true });
});

test("invalidate fires change hook with working=false for sessions becoming idle", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "idle" } } });
  await working.invalidate();
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    working: false,
  });
});

test("invalidate does not fire change hook when state unchanged", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await working.invalidate();
  expect(onChange).not.toHaveBeenCalled();
});

test("change hook errors bubble up from update", async () => {
  const { working } = setup();
  working.hook("change", () => {
    throw new Error("hook failed");
  });
  await expect(
    working.update(statusEvent("sess-1", { type: "busy" })),
  ).rejects.toThrow();
});

test("change hook errors bubble up from invalidate", async () => {
  const { existingSessions, working, sessionStatus } = setup();
  existingSessions.sessionIds = ["sess-1"];
  working.hook("change", () => {
    throw new Error("hook failed");
  });
  sessionStatus.mockResolvedValue({ data: { "sess-1": { type: "busy" } } });
  await expect(working.invalidate()).rejects.toThrow();
});
