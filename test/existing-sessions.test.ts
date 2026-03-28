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
      abort: vi.fn(async () => ({ data: undefined })),
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
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(es.check("s1")).toBe(true);
});

test("check returns false for non-existing session", () => {
  const { es } = setup();
  expect(es.check("s1")).toBe(false);
});

// --- find with createIfNotFound ---

test("find creates new session when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  const sessionId = await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledOnce();
  expect(logger.info).toHaveBeenCalledWith("New session is created", {
    sessionId: "s1",
    chatId: 123,
    threadId: undefined,
  });
  expect(es.get("s1", { throwIfNotFound: true })).toEqual({
    chatId: 123,
    threadId: undefined,
  });
  expect(es.sessionIds).toEqual(["s1"]);
});

test("find returns existing session without creating again when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const sessionId = await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(1);
});

test("find normalizes threadId 0 to undefined when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const sessionId = await es.find(
    { chatId: 123, threadId: 0 },
    { createIfNotFound: true },
  );

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(1);
});

test("find distinguishes sessions by threadId when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });

  await es.find({ chatId: 123, threadId: 5 }, { createIfNotFound: true });
  const sessionId = await es.find(
    { chatId: 123, threadId: 10 },
    { createIfNotFound: true },
  );

  expect(sessionId).toBe("s2");
});

test("find throws on opencode create error when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  const error = new Error("create failed");
  opencodeClient.session.create.mockRejectedValue(error);

  await expect(
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
  ).rejects.toBe(error);
});

test("find handles race condition by cleaning up and reusing winner", async () => {
  const { es, opencodeClient } = setup();
  let callCount = 0;
  opencodeClient.session.create.mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return { data: { id: "s-winner" } };
    return { data: { id: "s-loser" } };
  });
  opencodeClient.session.delete.mockResolvedValue({});

  const [first, second] = await Promise.all([
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
  ]);

  expect(first).toBe("s-winner");
  expect(second).toBe("s-winner");
  expect(es.get("s-winner", { throwIfNotFound: true })).toEqual({
    chatId: 123,
    threadId: undefined,
  });
  expect(opencodeClient.session.delete).toHaveBeenCalledWith(
    { sessionID: "s-loser" },
    { throwOnError: true },
  );
});

test("find rethrows insert error if no raced session found", async () => {
  const { es, opencodeClient, database } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.delete.mockResolvedValue({});
  const error = new Error("disk full");
  vi.spyOn(database, "insert").mockImplementationOnce(() => {
    throw error;
  });

  await expect(
    es.find({ chatId: 456, threadId: undefined }, { createIfNotFound: true }),
  ).rejects.toBe(error);
});

test("find throws on OpenCode delete error during race recovery", async () => {
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
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
  ]);

  // Winner succeeds, loser throws on orphan cleanup
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});

// --- invalidate ---

test("invalidate loads from DB and keeps reachable sessions", async () => {
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

test("invalidate picks up sessions added between calls", async () => {
  const { es, database } = setup();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();

  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1"]);

  database.insert(schema.session).values({ id: "s2", chatId: 200 }).run();
  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1", "s2"]);
});

test("invalidate includes sessions created via find with createIfNotFound", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.invalidate();
  expect(es.sessionIds).toEqual(["s1"]);
});

test("invalidate reflects sessions deleted from DB", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  database.delete(schema.session).where(eq(schema.session.id, "s1")).run();

  await es.invalidate();

  expect(es.sessionIds).toEqual([]);
});

// --- get ---

test("get returns location after find with createIfNotFound", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find({ chatId: 123, threadId: 7 }, { createIfNotFound: true });

  expect(es.get("s1", { throwIfNotFound: true })).toEqual({
    chatId: 123,
    threadId: 7,
  });
});

test("get normalizes threadId 0 to undefined", () => {
  const { es, database } = setup();
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 100, threadId: 0 })
    .run();

  expect(es.get("s1", { throwIfNotFound: true })).toEqual({
    chatId: 100,
    threadId: undefined,
  });
});

test("get throws for unknown session", () => {
  const { es } = setup();

  expect(() => es.get("unknown", { throwIfNotFound: true })).toThrow(
    ExistingSessions.NotFoundError,
  );
  expect(() => es.get("unknown", { throwIfNotFound: true })).toThrow(
    expect.objectContaining({ sessionId: "unknown" }),
  );
});

test("get returns undefined for unknown session by default", () => {
  const { es } = setup();

  expect(es.get("unknown")).toBeUndefined();
});

test("get returns undefined for unknown session when throwIfNotFound is false", () => {
  const { es } = setup();

  expect(es.get("unknown", { throwIfNotFound: false })).toBeUndefined();
});

// --- find ---

test("find returns sessionId for existing session", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(es.find({ chatId: 123, threadId: undefined })).toBe("s1");
});

test("find returns undefined for non-existing location", () => {
  const { es } = setup();
  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();
});

test("find distinguishes by threadId", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });
  await es.find({ chatId: 123, threadId: 5 }, { createIfNotFound: true });
  await es.find({ chatId: 123, threadId: 10 }, { createIfNotFound: true });
  expect(es.find({ chatId: 123, threadId: 5 })).toBe("s1");
  expect(es.find({ chatId: 123, threadId: 10 })).toBe("s2");
  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();
});

test("find returns undefined after session is removed", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.remove("s1");
  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();
});

// --- remove ---

test("remove deletes from database", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
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

test("remove throws and cleans state on abort error", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.abort.mockRejectedValue(new Error("abort failed"));
  const { es } = setup(undefined, opencodeClient);

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await expect(es.remove("s1")).rejects.toThrow("abort failed");
  expect(es.sessionIds).toEqual([]);
});

test("remove throws and preserves session on DB error", async () => {
  const { es, database, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  vi.spyOn(database, "delete").mockImplementationOnce(() => {
    throw new Error("disk full");
  });
  await expect(es.remove("s1")).rejects.toThrow("disk full");
  expect(es.sessionIds).toEqual(["s1"]);
});

// --- hooks ---

test("beforeRemove hook is called with session data", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
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

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
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
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.remove("s1");
  unregister();
  await es.find(
    { chatId: 456, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.remove("s2");

  expect(beforeRemove).toHaveBeenCalledTimes(1);
});

// --- sessionIds ---

test("sessionIds starts empty", () => {
  const { es } = setup();
  expect(es.sessionIds).toEqual([]);
});

test("sessionIds reflects find additions when createIfNotFound is true", async () => {
  const { es, opencodeClient } = setup();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });

  await es.find(
    { chatId: 100, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.find({ chatId: 200, threadId: 5 }, { createIfNotFound: true });

  expect(es.sessionIds).toEqual(["s1", "s2"]);
});
