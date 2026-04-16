import { afterEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import * as schema from "~/lib/schema";
import { sendRestartNotifications } from "~/lib/send-restart-notifications";

afterEach(() => {
  vi.restoreAllMocks();
});

function createBot() {
  return {
    api: {
      sendMessage: vi.fn(async () => ({})),
    },
  };
}

test("does nothing when no notifications exist", async () => {
  using database = Database.create();
  const bot = createBot();
  await sendRestartNotifications(bot as never, database);
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
});

test("sends notification and deletes the record", async () => {
  using database = Database.create();
  database
    .insert(schema.restartNotification)
    .values({ chatId: 100, threadId: 0, message: "✅ Skill active." })
    .run();
  const bot = createBot();
  await sendRestartNotifications(bot as never, database);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(100, "✅ Skill active.", {});
  const remaining = database.select().from(schema.restartNotification).all();
  expect(remaining).toHaveLength(0);
});

test("sends notification with thread ID", async () => {
  using database = Database.create();
  database
    .insert(schema.restartNotification)
    .values({ chatId: 200, threadId: 42, message: "✅ Done." })
    .run();
  const bot = createBot();
  await sendRestartNotifications(bot as never, database);
  expect(bot.api.sendMessage).toHaveBeenCalledWith(200, "✅ Done.", {
    message_thread_id: 42,
  });
});

test("sends multiple notifications", async () => {
  using database = Database.create();
  database
    .insert(schema.restartNotification)
    .values([
      { chatId: 1, threadId: 0, message: "a" },
      { chatId: 2, threadId: 0, message: "b" },
    ])
    .run();
  const bot = createBot();
  await sendRestartNotifications(bot as never, database);
  expect(bot.api.sendMessage).toHaveBeenCalledTimes(2);
  const remaining = database.select().from(schema.restartNotification).all();
  expect(remaining).toHaveLength(0);
});

test("continues and deletes record when sendMessage fails", async () => {
  using database = Database.create();
  database
    .insert(schema.restartNotification)
    .values([
      { chatId: 1, threadId: 0, message: "fail" },
      { chatId: 2, threadId: 0, message: "ok" },
    ])
    .run();
  const bot = createBot();
  bot.api.sendMessage
    .mockRejectedValueOnce(new Error("chat not found"))
    .mockResolvedValueOnce({});
  await sendRestartNotifications(bot as never, database);
  expect(bot.api.sendMessage).toHaveBeenCalledTimes(2);
  const remaining = database.select().from(schema.restartNotification).all();
  expect(remaining).toHaveLength(0);
});
