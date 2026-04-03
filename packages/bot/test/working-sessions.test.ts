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
  const sessionIds = new Set<string>(["sess-1"]);
  return {
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    check: (sessionId: string) => sessionIds.has(sessionId),
    hooks,
    sessionIds,
  } as unknown as ExistingSessions & {
    hooks: typeof hooks;
    sessionIds: Set<string>;
  };
}

function setup() {
  const existingSessions = mockExistingSessions();
  const working = WorkingSessions.create(existingSessions);
  return { existingSessions, working };
}

test("starts with no working sessions", () => {
  const { working } = setup();
  expect(working.check("sess-1")).toBe(false);
});

test("marks session as working on busy event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(working.check("sess-1")).toBe(true);
});

test("marks session as working on retry event", async () => {
  const { working } = setup();
  await working.update(
    statusEvent("sess-1", { type: "retry", attempt: 1, message: "", next: 0 }),
  );
  expect(working.check("sess-1")).toBe(true);
});

test("ignores busy update for removed session", async () => {
  const { existingSessions, working } = setup();
  existingSessions.sessionIds.delete("sess-1");
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(working.check("sess-1")).toBe(false);
});

test("does not mark uncached session as working on idle event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
});

test("removes a working session on idle event", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
});

test("does not fire change hook when working state is unchanged", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("silently drops stale cached state for removed session update", async () => {
  const { existingSessions, working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  existingSessions.sessionIds.delete("sess-1");
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(working.check("sess-1")).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});

test("fires change hook when session becomes working", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  expect(onChange).toHaveBeenCalledWith({ sessionId: "sess-1", working: true });
});

test("fires change hook when session stops working", async () => {
  const { working } = setup();
  const onChange = vi.fn();
  working.hook("change", onChange);
  await working.update(statusEvent("sess-1", { type: "busy" }));
  onChange.mockClear();
  await working.update(statusEvent("sess-1", { type: "idle" }));
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    working: false,
  });
});

test("beforeRemove releases cached sessions", async () => {
  const { existingSessions, working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 42,
    threadId: undefined,
  });
  expect(working.check("sess-1")).toBe(false);
});

test("beforeRemove does nothing for uncached sessions", async () => {
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

test("lock runs fn and passes session id", async () => {
  const { working } = setup();
  let received: string | undefined;
  await working.lock("sess-1", async (sessionId) => {
    received = sessionId;
  });
  expect(received).toBe("sess-1");
});

test("lock throws when session is already working", async () => {
  const { working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  await expect(working.lock("sess-1", async () => {})).rejects.toSatisfy(
    (error) =>
      error instanceof WorkingSessions.LockedError &&
      error.sessionId === "sess-1",
  );
});

test("lock throws on concurrent lock for the same session", async () => {
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

test("lock clears locked state when fn throws", async () => {
  const { working } = setup();
  await expect(
    working.lock("sess-1", async () => {
      throw new Error("fail");
    }),
  ).rejects.toThrow("fail");
  await working.lock("sess-1", async () => {});
});

test("dispose unhooks beforeRemove", async () => {
  const { existingSessions, working } = setup();
  working[Symbol.dispose]();
  expect(existingSessions.hooks["beforeRemove"]).toBeUndefined();
});

test("change hook errors bubble up from update", async () => {
  const { working } = setup();
  working.hook("change", () => {
    throw new Error("hook failed");
  });
  await expect(
    working.update(statusEvent("sess-1", { type: "busy" })),
  ).rejects.toThrow("hook failed");
});

test("change hook errors bubble up from beforeRemove", async () => {
  const { existingSessions, working } = setup();
  await working.update(statusEvent("sess-1", { type: "busy" }));
  working.hook("change", () => {
    throw new Error("hook failed");
  });
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 42,
      threadId: undefined,
    }),
  ).rejects.toThrow("hook failed");
});
