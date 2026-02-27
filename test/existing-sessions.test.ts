import { eq } from "drizzle-orm";
import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function createMockBot(
  sendChatAction: (...args: unknown[]) => Promise<void> = vi.fn(async () => {}),
) {
  return { api: { sendChatAction } } as never;
}

function createGoneError() {
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

function setup(bot = createMockBot(), opencodeClient = mockOpencodeClient()) {
  const database = Database.create();
  const es = ExistingSessions.create(bot, database, opencodeClient as never);
  return { database, opencodeClient, es };
}

// --- check ---

test("check returns true for existing session", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.findOrCreate(123, undefined);
  expect(es.check("s1")).toBe(true);
});

test("check returns false for non-existing session", () => {
  const { es } = setup();
  expect(es.check("s1")).toBe(false);
});

// --- findOrCreate ---

test("findOrCreate creates new session", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  const sessionId = await es.findOrCreate(123, undefined);

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledOnce();
  expect(logger.info).toHaveBeenCalledWith("New session is created", {
    sessionId: "s1",
    chatId: 123,
    threadId: undefined,
  });
  expect(es.resolve("s1")).toEqual({ chatId: 123, threadId: undefined });
  expect(es.sessionIds).toEqual(["s1"]);
});

test("findOrCreate returns cached session without creating again", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  const sessionId = await es.findOrCreate(123, undefined);

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(1);
});

test("findOrCreate normalizes threadId 0 to undefined", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  const sessionId = await es.findOrCreate(123, 0);

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(1);
});

test("findOrCreate distinguishes sessions by threadId", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });

  await es.findOrCreate(123, 5);
  const sessionId = await es.findOrCreate(123, 10);

  expect(sessionId).toBe("s2");
});

test("findOrCreate throws on opencode create error", async () => {
  const { es, opencodeClient } = setup();
  const error = new Error("create failed");
  opencodeClient.session.create.mockRejectedValue(error);

  await expect(es.findOrCreate(123, undefined)).rejects.toBe(error);
});

test("findOrCreate handles race condition by cleaning up and reusing winner", async () => {
  const { es, opencodeClient } = setup();
  let callCount = 0;
  opencodeClient.session.create.mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return { data: { id: "s-winner" } };
    return { data: { id: "s-loser" } };
  });
  opencodeClient.session.delete.mockResolvedValue({});

  const [first, second] = await Promise.all([
    es.findOrCreate(123, undefined),
    es.findOrCreate(123, undefined),
  ]);

  expect(first).toBe("s-winner");
  expect(second).toBe("s-winner");
  expect(es.resolve("s-winner")).toEqual({ chatId: 123, threadId: undefined });
  expect(opencodeClient.session.delete).toHaveBeenCalledWith(
    { sessionID: "s-loser" },
    { throwOnError: true },
  );
});

test("findOrCreate rethrows insert error if no raced session found", async () => {
  const { es, opencodeClient, database } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.delete.mockResolvedValue({});
  const error = new Error("disk full");
  vi.spyOn(database, "insert").mockImplementationOnce(() => {
    throw error;
  });

  await expect(es.findOrCreate(456, undefined)).rejects.toBe(error);
});

test("findOrCreate throws on OpenCode delete error during race recovery", async () => {
  const { es, opencodeClient } = setup();
  let callCount = 0;
  opencodeClient.session.create.mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return { data: { id: "s-winner" } };
    return { data: { id: "s-loser" } };
  });
  const error = new Error("delete failed");
  opencodeClient.session.delete.mockRejectedValue(error);

  const results = await Promise.allSettled([
    es.findOrCreate(123, undefined),
    es.findOrCreate(123, undefined),
  ]);

  // Winner succeeds, loser throws on orphan cleanup
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});

// --- invalidate ---

test("invalidate loads from DB on first run and keeps reachable sessions", async () => {
  const { es, database } = setup();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();

  await es.invalidate();

  expect(es.sessionIds).toEqual(["s1", "s2"]);
  expect(logger.debug).toHaveBeenCalledWith(
    "Current sessions are invalidated",
    {
      checked: 2,
      removed: 0,
      remaining: 2,
    },
  );
});

test("invalidate removes unreachable sessions", async () => {
  const sendChatAction = vi.fn(async (...args: unknown[]) => {
    if (args[0] === 200) throw createGoneError();
  });
  const { es, database } = setup(createMockBot(sendChatAction));
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();

  await es.invalidate();

  expect(es.sessionIds).toEqual(["s1"]);
});

test("invalidate removes all sessions when all unreachable", async () => {
  const sendChatAction = vi.fn(async () => {
    throw createGoneError();
  });
  const { es, database } = setup(createMockBot(sendChatAction));
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();

  await es.invalidate();

  expect(es.sessionIds).toEqual([]);
});

test("invalidate normalizes threadId in sendChatAction", async () => {
  const sendChatAction = vi.fn(async () => {});
  const { es, database } = setup(createMockBot(sendChatAction));
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();

  await es.invalidate();

  expect(sendChatAction).toHaveBeenCalledWith(100, "typing", {});
  expect(sendChatAction).toHaveBeenCalledWith(200, "typing", {
    message_thread_id: 5,
  });
});

test("invalidate throws on non-gone errors", async () => {
  const sendChatAction = vi.fn(async () => {
    throw new Error("network error");
  });
  const { es, database } = setup(createMockBot(sendChatAction));
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();

  await expect(es.invalidate()).rejects.toThrow("network error");
});

test("invalidate handles empty sessions", async () => {
  const { es } = setup();

  await es.invalidate();

  expect(es.sessionIds).toEqual([]);
  expect(logger.debug).toHaveBeenCalledWith(
    "Current sessions are invalidated",
    {
      checked: 0,
      removed: 0,
      remaining: 0,
    },
  );
});

test("invalidate restores from DB only on first run", async () => {
  const { es, database } = setup();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();

  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1"]);

  // Add a session to DB after first invalidate — should not be picked up
  database.insert(schema.session).values({ id: "s2", chatId: 200 }).run();
  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1"]);
});

test("invalidate skips DB sessions already in memory", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.findOrCreate(123, undefined);
  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1"]);
});

test("invalidate checks in-memory sessions not in DB", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  database.delete(schema.session).where(eq(schema.session.id, "s1")).run();

  await es.invalidate();

  expect(es.sessionIds).toEqual(["s1"]);
});

// --- resolve ---

test("check returns false for unknown session", () => {
  const { es } = setup();
  expect(es.check("unknown")).toBe(false);
});

test("resolve returns location after findOrCreate", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, 7);

  expect(es.resolve("s1")).toEqual({ chatId: 123, threadId: 7 });
});

test("resolve normalizes threadId 0 to undefined via invalidate", async () => {
  const { es, database } = setup();
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 100, threadId: 0 })
    .run();

  await es.invalidate();

  expect(es.resolve("s1")).toEqual({ chatId: 100, threadId: undefined });
});

test("resolve throws for unknown session", () => {
  const { es } = setup();

  expect(() => es.resolve("unknown")).toThrow(ExistingSessions.NotFoundError);
  expect(() => es.resolve("unknown")).toThrow(
    expect.objectContaining({ sessionId: "unknown" }),
  );
});

test("resolve returns location after findOrCreate", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, 7);

  expect(es.resolve("s1")).toEqual({ chatId: 123, threadId: 7 });
});

// --- remove ---

test("remove deletes from maps and database", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  await es.remove("s1");

  expect(es.check("s1")).toBe(false);
  expect(es.sessionIds).toEqual([]);
  const row = database
    .select()
    .from(schema.session)
    .where(eq(schema.session.id, "s1"))
    .get();
  expect(row).toBeUndefined();
  expect(logger.info).toHaveBeenCalledWith("Existing session is removed", {
    sessionId: "s1",
  });
});

test("remove is no-op for unknown session", async () => {
  const { es } = setup();
  await expect(es.remove("nonexistent")).resolves.toBeUndefined();
});

test("remove throws and cleans state on DB error", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  database[Symbol.dispose]();
  await expect(es.remove("s1")).rejects.toThrow();
  expect(es.sessionIds).toEqual([]);
});

// --- hooks ---

test("beforeRemove hook is called with session data", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  const beforeRemove = vi.fn();
  es.hook("beforeRemove", beforeRemove);
  await es.remove("s1");

  expect(beforeRemove).toHaveBeenCalledWith({
    sessionId: "s1",
    chatId: 123,
    threadId: undefined,
  });
});

test("beforeRemove hook awaits async hooks", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.findOrCreate(123, undefined);
  const order: string[] = [];
  es.hook("beforeRemove", async () => {
    await Promise.resolve();
    order.push("hook");
  });
  await es.remove("s1");
  order.push("done");

  expect(order).toEqual(["hook", "done"]);
});

test("hook returns unregister function", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });

  const beforeRemove = vi.fn();
  const unregister = es.hook("beforeRemove", beforeRemove);
  await es.findOrCreate(123, undefined);
  await es.remove("s1");
  unregister();
  await es.findOrCreate(456, undefined);
  await es.remove("s2");

  expect(beforeRemove).toHaveBeenCalledTimes(1);
});

// --- sessionIds ---

test("sessionIds starts empty", () => {
  const { es } = setup();
  expect(es.sessionIds).toEqual([]);
});

test("sessionIds reflects findOrCreate additions", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });

  await es.findOrCreate(100, undefined);
  await es.findOrCreate(200, 5);

  expect(es.sessionIds).toEqual(["s1", "s2"]);
});
