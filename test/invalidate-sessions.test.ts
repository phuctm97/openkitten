import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { invalidateSessions } from "~/lib/invalidate-sessions";

const now = new Date();
const session1 = {
  id: "s1",
  chatId: 100,
  threadId: 0,
  createdAt: now,
  updatedAt: now,
};
const session2 = {
  id: "s2",
  chatId: 200,
  threadId: 5,
  createdAt: now,
  updatedAt: now,
};

function createMockBot(sendChatAction: (...args: unknown[]) => Promise<void>) {
  return { api: { sendChatAction } } as never;
}

function createMockDatabase(sessions: unknown[]) {
  const where = vi.fn();
  const deleteFn = vi.fn(() => ({ where }));
  return {
    query: { session: { findMany: vi.fn(async () => sessions) } },
    delete: deleteFn,
    _where: where,
  };
}

function createAccessError() {
  return new GrammyError(
    "Call to 'sendChatAction' failed! (403: Forbidden: bot was blocked by the user)",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendChatAction",
    {},
  );
}

test("returns all sessions as reachable when accessible", async () => {
  const bot = createMockBot(vi.fn(async () => {}));
  const db = createMockDatabase([session1, session2]);
  const result = await invalidateSessions(bot, db as never);
  expect(result.reachable).toEqual([session1, session2]);
  expect(result.unreachable).toEqual([]);
  expect(db.delete).not.toHaveBeenCalled();
});

test("returns inaccessible sessions as unreachable and deletes them", async () => {
  const bot = createMockBot(
    vi.fn(async (...args: unknown[]) => {
      if (args[0] === 200) throw createAccessError();
    }),
  );
  const db = createMockDatabase([session1, session2]);
  const result = await invalidateSessions(bot, db as never);
  expect(result.reachable).toEqual([session1]);
  expect(result.unreachable).toEqual([session2]);
  expect(db.delete).toHaveBeenCalledOnce();
  expect(db._where).toHaveBeenCalledOnce();
});

test("returns all sessions as unreachable when all inaccessible", async () => {
  const bot = createMockBot(
    vi.fn(async () => {
      throw createAccessError();
    }),
  );
  const db = createMockDatabase([session1, session2]);
  const result = await invalidateSessions(bot, db as never);
  expect(result.reachable).toEqual([]);
  expect(result.unreachable).toEqual([session1, session2]);
  expect(db.delete).toHaveBeenCalledOnce();
});

test("passes thread id when present", async () => {
  const sendChatAction = vi.fn(async () => {});
  const bot = createMockBot(sendChatAction);
  const db = createMockDatabase([session2]);
  await invalidateSessions(bot, db as never);
  expect(sendChatAction).toHaveBeenCalledWith(200, "typing", {
    message_thread_id: 5,
  });
});

test("omits thread id when zero", async () => {
  const sendChatAction = vi.fn(async () => {});
  const bot = createMockBot(sendChatAction);
  const db = createMockDatabase([session1]);
  await invalidateSessions(bot, db as never);
  expect(sendChatAction).toHaveBeenCalledWith(100, "typing", {});
});

test("throws on non-access errors", async () => {
  const bot = createMockBot(
    vi.fn(async () => {
      throw new Error("network error");
    }),
  );
  const db = createMockDatabase([session1]);
  await expect(invalidateSessions(bot, db as never)).rejects.toThrow(
    "network error",
  );
});

test("returns empty arrays when no sessions", async () => {
  const bot = createMockBot(vi.fn(async () => {}));
  const db = createMockDatabase([]);
  const result = await invalidateSessions(bot, db as never);
  expect(result.reachable).toEqual([]);
  expect(result.unreachable).toEqual([]);
});
