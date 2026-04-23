import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { upgradeOpenkitten } from "~/lib/upgrade-openkitten";

function mockDatabase(
  sessions: readonly { chatId: number; threadId: number }[] = [],
) {
  const insertValues = vi.fn(() => ({ run: vi.fn() }));
  const database = {
    query: {
      session: {
        findMany: vi.fn(() => ({ sync: () => sessions })),
      },
    },
    insert: vi.fn(() => ({ values: insertValues })),
  };
  return { database, insertValues };
}

function mockBot() {
  const sendMessage = vi.fn(async () => ({}));
  return { bot: { api: { sendMessage } }, sendMessage };
}

const originalSpawn = Bun.spawn;

beforeEach(() => {
  Bun.env["OPENKITTEN_ENABLE_UPGRADE"] = "1";
});

afterEach(() => {
  Object.assign(Bun, { spawn: originalSpawn });
  delete Bun.env["OPENKITTEN_ENABLE_UPGRADE"];
});

test("throws when OPENKITTEN_ENABLE_UPGRADE is not set", async () => {
  delete Bun.env["OPENKITTEN_ENABLE_UPGRADE"];
  const spawn = vi.fn();
  Object.assign(Bun, { spawn });
  const { bot, sendMessage } = mockBot();
  const { database, insertValues } = mockDatabase([
    { chatId: 100, threadId: 0 },
  ]);
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("Upgrade is disabled"),
  });
  expect(spawn).not.toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
  expect(insertValues).not.toHaveBeenCalled();
});

test("notifies sessions and spawns `bun . up --yes` detached", async () => {
  const unref = vi.fn();
  const spawn = vi.fn(() => ({
    stdin: null,
    stdout: null,
    stderr: null,
    exited: Promise.resolve(0),
    unref,
  }));
  Object.assign(Bun, { spawn });
  const { bot, sendMessage } = mockBot();
  const { database, insertValues } = mockDatabase([
    { chatId: 100, threadId: 0 },
    { chatId: 200, threadId: 7 },
  ]);
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result).toEqual({ kind: "restarting" });
  expect(sendMessage).toHaveBeenNthCalledWith(
    1,
    100,
    "⏳ Upgrading OpenKitten…",
    {},
  );
  expect(sendMessage).toHaveBeenNthCalledWith(
    2,
    200,
    "⏳ Upgrading OpenKitten…",
    { message_thread_id: 7 },
  );
  expect(insertValues).toHaveBeenNthCalledWith(1, {
    chatId: 100,
    threadId: 0,
    message: "✅ OpenKitten upgraded",
  });
  expect(insertValues).toHaveBeenNthCalledWith(2, {
    chatId: 200,
    threadId: 7,
    message: "✅ OpenKitten upgraded",
  });
  expect(spawn).toHaveBeenCalledWith(
    [process.execPath, process.argv[1], "up", "--yes"],
    expect.objectContaining({
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
    }),
  );
  expect(unref).toHaveBeenCalled();
});

test("skips restart notification when sendMessage fails", async () => {
  const unref = vi.fn();
  Object.assign(Bun, {
    spawn: vi.fn(() => ({
      stdin: null,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      unref,
    })),
  });
  const { bot, sendMessage } = mockBot();
  sendMessage.mockRejectedValueOnce(new Error("blocked"));
  const { database, insertValues } = mockDatabase([
    { chatId: 100, threadId: 0 },
    { chatId: 200, threadId: 0 },
  ]);
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result.kind).toBe("restarting");
  expect(insertValues).toHaveBeenCalledTimes(1);
  expect(insertValues).toHaveBeenCalledWith({
    chatId: 200,
    threadId: 0,
    message: "✅ OpenKitten upgraded",
  });
});
