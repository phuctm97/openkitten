import { expect, test } from "vitest";
import { createBusySessions } from "~/lib/create-busy-sessions";
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
  const busy = createBusySessions();
  expect(busy.sessionIds).toEqual([]);
  expect(busy.check("sess-1")).toBe(false);
});

test("marks session as busy when status is busy", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const busy = createBusySessions();
  busy.invalidate(snapshot, session);
  expect(busy.check("sess-1")).toBe(true);
  expect(busy.sessionIds).toEqual(["sess-1"]);
});

test("marks session as busy when status is retry", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: {
      "sess-1": { type: "retry", attempt: 1, message: "", next: 0 },
    },
    questions: [],
    permissions: [],
  };
  const busy = createBusySessions();
  busy.invalidate(snapshot, session);
  expect(busy.check("sess-1")).toBe(true);
});

test("does not mark session as busy when idle", () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  const busy = createBusySessions();
  busy.invalidate(snapshot, session);
  expect(busy.check("sess-1")).toBe(false);
});

test("does not mark session as busy when status is missing", () => {
  const busy = createBusySessions();
  busy.invalidate(emptySnapshot, session);
  expect(busy.check("sess-1")).toBe(false);
});

test("removes session when it becomes idle", () => {
  const busySnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const idleSnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  const busy = createBusySessions();
  busy.invalidate(busySnapshot, session);
  expect(busy.check("sess-1")).toBe(true);
  busy.invalidate(idleSnapshot, session);
  expect(busy.check("sess-1")).toBe(false);
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
  const busy = createBusySessions();
  busy.invalidate(snapshot, session, session2);
  expect(busy.check("sess-1")).toBe(true);
  expect(busy.check("sess-2")).toBe(false);
  expect(busy.sessionIds).toEqual(["sess-1"]);
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
  const busy = createBusySessions();
  busy.invalidate(snapshot, session, session2);
  busy.remove("sess-1");
  expect(busy.check("sess-1")).toBe(false);
  expect(busy.check("sess-2")).toBe(true);
  expect(busy.sessionIds).toEqual(["sess-2"]);
});

test("remove with no args is a no-op", () => {
  const busy = createBusySessions();
  busy.remove();
  expect(busy.sessionIds).toEqual([]);
});

test("remove with unknown id is a no-op", () => {
  const busy = createBusySessions();
  busy.remove("unknown");
  expect(busy.sessionIds).toEqual([]);
});

test("invalidate with no sessions is a no-op", () => {
  const busy = createBusySessions();
  busy.invalidate(emptySnapshot);
  expect(busy.sessionIds).toEqual([]);
});
