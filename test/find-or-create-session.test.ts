import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { createDatabase } from "~/lib/create-database";
import { findOrCreateSession } from "~/lib/find-or-create-session";
import * as schema from "~/lib/schema";

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

test("creates new session when none exists", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });

  const result = await findOrCreateSession(
    database,
    opencodeClient as never,
    123,
    undefined,
  );

  expect(result).toEqual({ sessionId: "s1", isNew: true });
  expect(opencodeClient.session.create).toHaveBeenCalledOnce();
  expect(consola.success).toHaveBeenCalledWith("New session created", {
    chatId: 123,
    threadId: undefined,
  });
});

test("returns existing session", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 123 }).run();
  const opencodeClient = mockOpencodeClient();

  const result = await findOrCreateSession(
    database,
    opencodeClient as never,
    123,
    undefined,
  );

  expect(result).toEqual({ sessionId: "s1", isNew: false });
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
});

test("normalizes undefined threadId to 0", async () => {
  using database = createDatabase(":memory:");
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 123, threadId: 0 })
    .run();
  const opencodeClient = mockOpencodeClient();

  const result = await findOrCreateSession(
    database,
    opencodeClient as never,
    123,
    undefined,
  );

  expect(result).toEqual({ sessionId: "s1", isNew: false });
});

test("distinguishes sessions by threadId", async () => {
  using database = createDatabase(":memory:");
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 123, threadId: 5 })
    .run();
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s2" } });

  const result = await findOrCreateSession(
    database,
    opencodeClient as never,
    123,
    10,
  );

  expect(result).toEqual({ sessionId: "s2", isNew: true });
});

test("throws on opencode create error", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  const error = new Error("create failed");
  opencodeClient.session.create.mockRejectedValue(error);

  await expect(
    findOrCreateSession(database, opencodeClient as never, 123, undefined),
  ).rejects.toBe(error);
});

test("handles race condition by cleaning up and reusing winner", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  // Simulate the winner being inserted by a concurrent call between the
  // initial query and the loser's insert attempt.
  opencodeClient.session.create.mockImplementation(async () => {
    database
      .insert(schema.session)
      .values({ id: "s-winner", chatId: 123 })
      .run();
    return { data: { id: "s-loser" } };
  });
  opencodeClient.session.delete.mockResolvedValue({});

  const result = await findOrCreateSession(
    database,
    opencodeClient as never,
    123,
    undefined,
  );

  expect(result).toEqual({ sessionId: "s-winner", isNew: false });
  expect(opencodeClient.session.delete).toHaveBeenCalledWith(
    { sessionID: "s-loser" },
    { throwOnError: true },
  );
});

test("rethrows insert error if no raced session found", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.delete.mockResolvedValue({});

  // Simulate a non-unique-constraint insert failure (e.g. disk full).
  const insertError = new Error("disk full");
  vi.spyOn(database, "insert").mockImplementationOnce(() => {
    throw insertError;
  });

  await expect(
    findOrCreateSession(database, opencodeClient as never, 456, undefined),
  ).rejects.toBe(insertError);
});

test("throws on opencode delete error during race recovery", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.create.mockImplementation(async () => {
    database
      .insert(schema.session)
      .values({ id: "s-winner", chatId: 123 })
      .run();
    return { data: { id: "s-loser" } };
  });
  const error = new Error("delete failed");
  opencodeClient.session.delete.mockRejectedValue(error);

  await expect(
    findOrCreateSession(database, opencodeClient as never, 123, undefined),
  ).rejects.toBe(error);
});
