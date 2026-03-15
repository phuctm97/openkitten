import { expect, test } from "vitest";
import { createWorkingSessions } from "~/lib/create-working-sessions";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";

const now = new Date();
const session = {
  id: "sess-1",
  chatId: 123,
  threadId: 0,
  createdAt: now,
  updatedAt: now,
};
const session2 = {
  id: "sess-2",
  chatId: 456,
  threadId: 0,
  createdAt: now,
  updatedAt: now,
};

const emptySnapshot: OpencodeSnapshot = {
  statuses: {},
  questions: [],
  permissions: [],
};

test("starts with no sessions", () => {
  const working = createWorkingSessions();
  expect(working.sessionIds).toEqual([]);
  expect(working.check("sess-1")).toBe(false);
});

test("marks session as working when status is busy", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(snapshot, session);
  expect(working.check("sess-1")).toBe(true);
  expect(working.sessionIds).toEqual(["sess-1"]);
});

test("marks session as working when status is retry", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: {
      "sess-1": { type: "retry", attempt: 1, message: "", next: 0 },
    },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(snapshot, session);
  expect(working.check("sess-1")).toBe(true);
});

test("does not mark session as working when idle", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(snapshot, session);
  expect(working.check("sess-1")).toBe(false);
});

test("does not mark session as working when status is missing", () => {
  const working = createWorkingSessions();
  working.invalidate(emptySnapshot, session);
  expect(working.check("sess-1")).toBe(false);
});

test("removes session when it becomes idle", () => {
  const workingSnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const idleSnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(workingSnapshot, session);
  expect(working.check("sess-1")).toBe(true);
  working.invalidate(idleSnapshot, session);
  expect(working.check("sess-1")).toBe(false);
});

test("tracks multiple sessions independently", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: {
      "sess-1": { type: "busy" },
      "sess-2": { type: "idle" },
    },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(snapshot, session, session2);
  expect(working.check("sess-1")).toBe(true);
  expect(working.check("sess-2")).toBe(false);
  expect(working.sessionIds).toEqual(["sess-1"]);
});

test("remove deletes sessions by id", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: {
      "sess-1": { type: "busy" },
      "sess-2": { type: "busy" },
    },
    questions: [],
    permissions: [],
  };
  const working = createWorkingSessions();
  working.invalidate(snapshot, session, session2);
  working.remove("sess-1");
  expect(working.check("sess-1")).toBe(false);
  expect(working.check("sess-2")).toBe(true);
  expect(working.sessionIds).toEqual(["sess-2"]);
});

test("remove with no args is a no-op", () => {
  const working = createWorkingSessions();
  working.remove();
  expect(working.sessionIds).toEqual([]);
});

test("remove with unknown id is a no-op", () => {
  const working = createWorkingSessions();
  working.remove("unknown");
  expect(working.sessionIds).toEqual([]);
});

test("invalidate with no sessions is a no-op", () => {
  const working = createWorkingSessions();
  working.invalidate(emptySnapshot);
  expect(working.sessionIds).toEqual([]);
});
