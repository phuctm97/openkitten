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

async function setup(
  bot = createMockBot(),
  opencodeClient = mockOpencodeClient(),
) {
  const database = Database.create();
  const es = await ExistingSessions.create(
    bot,
    database,
    opencodeClient as never,
  );
  return { database, opencodeClient, es };
}

// --- check ---

test("check returns true for existing session", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(es.check("s1")).toBe(true);
});

test("check returns false for non-existing session", async () => {
  const { es } = await setup();
  expect(es.check("s1")).toBe(false);
});

// --- find with createIfNotFound ---

test("find creates new session when createIfNotFound is true", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  const sessionId = await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  expect(sessionId).toBe("s1");
  expect(opencodeClient.session.create).toHaveBeenCalledOnce();
  expect(es.get("s1")).toEqual({
    chatId: 123,
    threadId: undefined,
  });
  expect(es.sessionIds).toEqual(["s1"]);
});

test("find returns existing session without creating again when createIfNotFound is true", async () => {
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
  const error = new Error("create failed");
  opencodeClient.session.create.mockRejectedValue(error);

  await expect(
    es.find({ chatId: 123, threadId: undefined }, { createIfNotFound: true }),
  ).rejects.toBe(error);
});

test("find handles race condition by cleaning up and reusing winner", async () => {
  const { es, opencodeClient } = await setup();
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
  expect(es.get("s-winner")).toEqual({
    chatId: 123,
    threadId: undefined,
  });
  expect(opencodeClient.session.delete).toHaveBeenCalledWith(
    { sessionID: "s-loser" },
    { throwOnError: true },
  );
});

test("find rethrows insert error if no raced session found", async () => {
  const { es, opencodeClient, database } = await setup();
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
  const { es, opencodeClient } = await setup();
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

// --- create ---

test("create reconciles current sessions on startup", async () => {
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  const bot = createMockBot();
  const opencodeClient = mockOpencodeClient();
  const es = await ExistingSessions.create(
    bot,
    database,
    opencodeClient as never,
  );

  expect(es.sessionIds).toEqual(["s1"]);
});

test("create keeps reachable sessions", async () => {
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();
  const es = await ExistingSessions.create(
    createMockBot(),
    database,
    mockOpencodeClient() as never,
  );

  expect(es.sessionIds).toEqual(["s1", "s2"]);
});

test("create removes unreachable sessions", async () => {
  const sendChatAction = vi.fn(async (...args: unknown[]) => {
    if (args[0] === 200) throw createGoneError();
  });
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();
  const es = await ExistingSessions.create(
    createMockBot(sendChatAction),
    database,
    mockOpencodeClient() as never,
  );

  expect(es.sessionIds).toEqual(["s1"]);
});

test("create removes all unreachable sessions", async () => {
  const sendChatAction = vi.fn(async () => {
    throw createGoneError();
  });
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();
  const es = await ExistingSessions.create(
    createMockBot(sendChatAction),
    database,
    mockOpencodeClient() as never,
  );

  expect(es.sessionIds).toEqual([]);
});

test("create normalizes threadId in sendChatAction", async () => {
  const sendChatAction = vi.fn(async () => {});
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  database
    .insert(schema.session)
    .values({ id: "s2", chatId: 200, threadId: 5 })
    .run();
  await ExistingSessions.create(
    createMockBot(sendChatAction),
    database,
    mockOpencodeClient() as never,
  );

  expect(sendChatAction).toHaveBeenCalledWith(100, "typing", {});
  expect(sendChatAction).toHaveBeenCalledWith(200, "typing", {
    message_thread_id: 5,
  });
});

test("create throws on non-gone errors", async () => {
  const sendChatAction = vi.fn(async () => {
    throw new Error("network error");
  });
  const database = Database.create();
  database.insert(schema.session).values({ id: "s1", chatId: 100 }).run();
  await expect(
    ExistingSessions.create(
      createMockBot(sendChatAction),
      database,
      mockOpencodeClient() as never,
    ),
  ).rejects.toThrow("network error");
});

test("create handles empty sessions", async () => {
  const es = await ExistingSessions.create(
    createMockBot(),
    Database.create(),
    mockOpencodeClient() as never,
  );

  expect(es.sessionIds).toEqual([]);
});

// --- get ---

test("get returns location after find with createIfNotFound", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find({ chatId: 123, threadId: 7 }, { createIfNotFound: true });

  expect(es.get("s1")).toEqual({
    chatId: 123,
    threadId: 7,
  });
});

test("get normalizes threadId 0 to undefined", async () => {
  const { es, database } = await setup();
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 100, threadId: 0 })
    .run();

  expect(es.get("s1")).toEqual({
    chatId: 100,
    threadId: undefined,
  });
});

test("get with unsafe throws for unknown session", async () => {
  const { es } = await setup();

  expect(() => es.get("unknown", { unsafe: true })).toThrow(
    ExistingSessions.NotFoundError,
  );
  expect(() => es.get("unknown", { unsafe: true })).toThrow(
    expect.objectContaining({ sessionId: "unknown" }),
  );
});

test("get returns undefined for unknown session by default", async () => {
  const { es } = await setup();

  expect(es.get("unknown")).toBeUndefined();
});

test("get returns undefined for unknown session when unsafe is false", async () => {
  const { es } = await setup();

  expect(es.get("unknown", { unsafe: false })).toBeUndefined();
});

// --- find ---

test("find returns sessionId for existing session", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(es.find({ chatId: 123, threadId: undefined })).toBe("s1");
});

test("find returns undefined for non-existing location", async () => {
  const { es } = await setup();
  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();
});

test("find distinguishes by threadId", async () => {
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await es.remove("s1");
  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();
});

test("find returns undefined while session is being removed", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  const abort = Promise.withResolvers<void>();
  opencodeClient.session.abort.mockImplementation(async () => {
    await abort.promise;
    return { data: undefined };
  });
  const { es } = await setup(undefined, opencodeClient);

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const removal = es.remove("s1");

  expect(es.find({ chatId: 123, threadId: undefined })).toBeUndefined();

  abort.resolve();
  await removal;
});

test("find with createIfNotFound waits for removing session and creates replacement", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });
  const abort = Promise.withResolvers<void>();
  opencodeClient.session.abort.mockImplementation(async () => {
    await abort.promise;
    return { data: undefined };
  });
  const { es } = await setup(undefined, opencodeClient);

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const removal = es.remove("s1");
  const replacement = es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  await Promise.resolve();
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(1);

  abort.resolve();

  await expect(replacement).resolves.toBe("s2");
  await removal;
  expect(es.get("s2")).toEqual({
    chatId: 123,
    threadId: undefined,
  });
});

test("find with createIfNotFound retries when raced winner starts removing", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "s1" } })
    .mockResolvedValueOnce({ data: { id: "s-loser" } })
    .mockResolvedValueOnce({ data: { id: "s2" } });
  const abort = Promise.withResolvers<void>();
  opencodeClient.session.abort.mockImplementation(async () => {
    await abort.promise;
    return { data: undefined };
  });
  const orphanDeleteReached = Promise.withResolvers<void>();
  const releaseOrphanDelete = Promise.withResolvers<void>();
  opencodeClient.session.delete.mockImplementation(async () => {
    orphanDeleteReached.resolve();
    await releaseOrphanDelete.promise;
    return {};
  });
  const { es } = await setup(undefined, opencodeClient);

  const first = es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const second = es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  await expect(first).resolves.toBe("s1");
  await orphanDeleteReached.promise;

  const removal = es.remove("s1");
  releaseOrphanDelete.resolve();

  await Promise.resolve();
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(2);

  abort.resolve();

  await expect(second).resolves.toBe("s2");
  await removal;
  expect(es.get("s2")).toEqual({
    chatId: 123,
    threadId: undefined,
  });
});

test("find with createIfNotFound reuses replacement created during waited removal", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  const { database, es } = await setup(undefined, opencodeClient);
  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const abort = Promise.withResolvers<void>();
  opencodeClient.session.abort.mockImplementation(async () => {
    await abort.promise;
    return { data: undefined };
  });
  const originalDelete = database.delete.bind(database);
  vi.spyOn(database, "delete").mockImplementation(((
    table: typeof schema.session,
  ) => {
    const query = originalDelete(table);
    const originalWhere = query.where.bind(query);
    query.where = ((condition: Parameters<typeof query.where>[0]) => {
      const runner = originalWhere(condition);
      const originalRun = runner.run.bind(runner);
      runner.run = () => {
        originalRun();
        database
          .insert(schema.session)
          .values({ id: "s2", chatId: 123, threadId: 0 })
          .run();
      };
      return runner;
    }) as never;
    return query;
  }) as never);

  const removal = es.remove("s1");
  const replacement = es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );

  abort.resolve();

  await expect(replacement).resolves.toBe("s2");
  await removal;
  expect(opencodeClient.session.create).toHaveBeenCalledOnce();
});

// --- remove ---

test("remove deletes from database", async () => {
  const { es, database, opencodeClient } = await setup();
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
});

test("remove is no-op for unknown session", async () => {
  const { es } = await setup();
  await expect(es.remove("nonexistent")).resolves.toBeUndefined();
});

test("concurrent remove shares in-flight removal", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  const abort = Promise.withResolvers<void>();
  opencodeClient.session.abort.mockImplementation(async () => {
    await abort.promise;
    return { data: undefined };
  });
  const { es } = await setup(undefined, opencodeClient);

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const first = es.remove("s1");
  const second = es.remove("s1");

  expect(opencodeClient.session.abort).toHaveBeenCalledTimes(1);

  abort.resolve();
  await Promise.all([first, second]);
});

test("remove throws and cleans state on abort error", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.abort.mockRejectedValue(new Error("abort failed"));
  const { es } = await setup(undefined, opencodeClient);

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  await expect(es.remove("s1")).rejects.toThrow("abort failed");
  expect(es.sessionIds).toEqual([]);
  expect(logger.info).not.toHaveBeenCalledWith("Existing session is removed", {
    sessionId: "s1",
  });
});

test("remove throws and preserves session on DB error", async () => {
  const { es, database, opencodeClient } = await setup();
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
  expect(logger.info).not.toHaveBeenCalledWith("Existing session is removed", {
    sessionId: "s1",
  });
});

test("check returns false while session is being removed", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  const checks: boolean[] = [];
  es.hook("beforeRemove", () => {
    checks.push(es.check("s1"));
  });

  await es.remove("s1");

  expect(checks).toEqual([false]);
});

test("get returns undefined while session is being removed", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  let location: ExistingSessions.Location | undefined;
  es.hook("beforeRemove", () => {
    location = es.get("s1");
  });

  await es.remove("s1");

  expect(location).toBeUndefined();
});

test("get with unsafe returns location while session is being removed", async () => {
  const { es, opencodeClient } = await setup();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  await es.find(
    { chatId: 123, threadId: undefined },
    { createIfNotFound: true },
  );
  let location: ExistingSessions.Location | undefined;
  es.hook("beforeRemove", () => {
    location = es.get("s1", { unsafe: true });
  });

  await es.remove("s1");

  expect(location).toEqual({
    chatId: 123,
    threadId: undefined,
  });
});

// --- hooks ---

test("beforeRemove hook is called with session data", async () => {
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
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
  const { es, opencodeClient } = await setup();
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

test("sessionIds starts empty", async () => {
  const { es } = await setup();
  expect(es.sessionIds).toEqual([]);
});

test("sessionIds reflects find additions when createIfNotFound is true", async () => {
  const { es, opencodeClient } = await setup();
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
