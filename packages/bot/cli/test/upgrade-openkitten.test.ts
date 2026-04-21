import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { upgradeOpenkitten } from "~/lib/upgrade-openkitten";

interface SpawnScript {
  readonly match: readonly string[];
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function streamFor(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (text) controller.enqueue(encode(text));
      controller.close();
    },
  });
}

function cmdMatches(cmd: readonly string[], match: readonly string[]): boolean {
  if (cmd.length !== match.length) return false;
  return cmd.every((part, i) => part === match[i]);
}

function mockSpawn(scripts: readonly SpawnScript[]): ReturnType<typeof vi.fn> {
  const queue = [...scripts];
  return vi.fn((cmd: readonly string[]) => {
    const script = queue.shift();
    if (!script) {
      throw new Error(`Unexpected spawn (queue empty): ${cmd.join(" ")}`);
    }
    if (!cmdMatches(cmd, script.match)) {
      throw new Error(
        `Unexpected spawn: got ${cmd.join(" ")}, expected ${script.match.join(" ")}`,
      );
    }
    return {
      stdout: streamFor(script.stdout ?? ""),
      stderr: streamFor(script.stderr ?? ""),
      exited: Promise.resolve(script.exitCode ?? 0),
      unref: vi.fn(),
    };
  });
}

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
  Bun.env["OPENKITTEN_PROFILE"] = "default";
});

afterEach(() => {
  Object.assign(Bun, { spawn: originalSpawn });
  delete Bun.env["OPENKITTEN_PROFILE"];
});

test("throws when branch is not main", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "dev\n" },
    ]),
  });
  const { bot } = mockBot();
  const { database } = mockDatabase();
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("non-main branch: dev"),
  });
});

test("throws when worktree is dirty", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: " M file.ts\n" },
    ]),
  });
  const { bot } = mockBot();
  const { database } = mockDatabase();
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("dirty worktree"),
  });
});

test("returns up-to-date when HEAD matches origin/main", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      { match: ["git", "fetch", "origin", "main"], stdout: "" },
      { match: ["git", "rev-parse", "HEAD"], stdout: `${"a".repeat(40)}\n` },
      {
        match: ["git", "rev-parse", "origin/main"],
        stdout: `${"a".repeat(40)}\n`,
      },
    ]),
  });
  const { bot, sendMessage } = mockBot();
  const { database } = mockDatabase();
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result).toEqual({ kind: "up-to-date", sha: "aaaaaaa" });
  expect(sendMessage).not.toHaveBeenCalled();
});

test("pulls, installs, notifies sessions, and returns restarting", async () => {
  const previous = "1".repeat(40);
  const upstream = "2".repeat(40);
  const next = "2".repeat(40);
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      { match: ["git", "fetch", "origin", "main"], stdout: "" },
      { match: ["git", "rev-parse", "HEAD"], stdout: `${previous}\n` },
      { match: ["git", "rev-parse", "origin/main"], stdout: `${upstream}\n` },
      { match: ["git", "pull", "--ff-only", "origin", "main"], stdout: "" },
      { match: ["bun", "install"], stdout: "" },
      { match: ["git", "rev-parse", "HEAD"], stdout: `${next}\n` },
    ]),
  });
  const { bot, sendMessage } = mockBot();
  const { database, insertValues } = mockDatabase([
    { chatId: 100, threadId: 0 },
    { chatId: 200, threadId: 7 },
  ]);
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result).toEqual({
    kind: "restarting",
    previousSha: "1111111",
    nextSha: "2222222",
  });
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
    message: "✅ Upgraded 1111111 → 2222222",
  });
  expect(insertValues).toHaveBeenNthCalledWith(2, {
    chatId: 200,
    threadId: 7,
    message: "✅ Upgraded 1111111 → 2222222",
  });
});

test("skips restart notification when sendMessage fails", async () => {
  const previous = "1".repeat(40);
  const next = "3".repeat(40);
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      { match: ["git", "fetch", "origin", "main"], stdout: "" },
      { match: ["git", "rev-parse", "HEAD"], stdout: `${previous}\n` },
      { match: ["git", "rev-parse", "origin/main"], stdout: `${next}\n` },
      { match: ["git", "pull", "--ff-only", "origin", "main"], stdout: "" },
      { match: ["bun", "install"], stdout: "" },
      { match: ["git", "rev-parse", "HEAD"], stdout: `${next}\n` },
    ]),
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
    message: "✅ Upgraded 1111111 → 3333333",
  });
});

test("wraps non-zero git exit into UpgradeOpenkittenError with stderr", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      {
        match: ["git", "fetch", "origin", "main"],
        stderr: "fatal: offline\n",
        exitCode: 128,
      },
    ]),
  });
  const { bot } = mockBot();
  const { database } = mockDatabase();
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("fatal: offline"),
  });
});

test("falls back to stdout when stderr is empty on failure", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      {
        match: ["git", "fetch", "origin", "main"],
        stdout: "something happened\n",
        stderr: "",
        exitCode: 1,
      },
    ]),
  });
  const { bot } = mockBot();
  const { database } = mockDatabase();
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("something happened"),
  });
});

test("wraps non-zero exit with no output into UpgradeOpenkittenError with exit code", async () => {
  Object.assign(Bun, {
    spawn: mockSpawn([
      { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
      { match: ["git", "status", "--porcelain"], stdout: "" },
      { match: ["git", "fetch", "origin", "main"], exitCode: 1 },
    ]),
  });
  const { bot } = mockBot();
  const { database } = mockDatabase();
  await expect(
    upgradeOpenkitten({ bot: bot as never, database: database as never }),
  ).rejects.toMatchObject({
    name: "UpgradeOpenkittenError",
    message: expect.stringContaining("exited with code 1"),
  });
});

test("spawns detached respawner when not service-managed", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const previous = "1".repeat(40);
  const next = "2".repeat(40);
  const unref = vi.fn();
  const spawn = vi.fn((cmd: readonly string[]) => {
    if (cmd[0] === process.execPath) {
      return { stdout: null, stderr: null, exited: Promise.resolve(0), unref };
    }
    const script = spawnQueue.shift();
    if (!script || !cmdMatches(cmd, script.match)) {
      throw new Error(`Unexpected spawn: ${cmd.join(" ")}`);
    }
    return {
      stdout: streamFor(script.stdout ?? ""),
      stderr: streamFor(script.stderr ?? ""),
      exited: Promise.resolve(script.exitCode ?? 0),
      unref: vi.fn(),
    };
  });
  const spawnQueue: SpawnScript[] = [
    { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
    { match: ["git", "status", "--porcelain"], stdout: "" },
    { match: ["git", "fetch", "origin", "main"], stdout: "" },
    { match: ["git", "rev-parse", "HEAD"], stdout: `${previous}\n` },
    { match: ["git", "rev-parse", "origin/main"], stdout: `${next}\n` },
    { match: ["git", "pull", "--ff-only", "origin", "main"], stdout: "" },
    { match: ["bun", "install"], stdout: "" },
    { match: ["git", "rev-parse", "HEAD"], stdout: `${next}\n` },
  ];
  Object.assign(Bun, { spawn });
  const { bot } = mockBot();
  const { database } = mockDatabase([{ chatId: 100, threadId: 0 }]);
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result.kind).toBe("restarting");
  expect(spawn).toHaveBeenCalledWith(
    [process.execPath, ...process.argv.slice(1), "--yes"],
    expect.objectContaining({
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  expect(unref).toHaveBeenCalled();
});

test("skips respawn when service-managed", async () => {
  const previous = "1".repeat(40);
  const next = "2".repeat(40);
  const spawn = mockSpawn([
    { match: ["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout: "main\n" },
    { match: ["git", "status", "--porcelain"], stdout: "" },
    { match: ["git", "fetch", "origin", "main"], stdout: "" },
    { match: ["git", "rev-parse", "HEAD"], stdout: `${previous}\n` },
    { match: ["git", "rev-parse", "origin/main"], stdout: `${next}\n` },
    { match: ["git", "pull", "--ff-only", "origin", "main"], stdout: "" },
    { match: ["bun", "install"], stdout: "" },
    { match: ["git", "rev-parse", "HEAD"], stdout: `${next}\n` },
  ]);
  Object.assign(Bun, { spawn });
  const { bot } = mockBot();
  const { database } = mockDatabase([{ chatId: 100, threadId: 0 }]);
  const result = await upgradeOpenkitten({
    bot: bot as never,
    database: database as never,
  });
  expect(result.kind).toBe("restarting");
  // The mock throws on unexpected spawn, so absence of a respawn call means
  // service-managed mode skipped it correctly.
  expect(spawn).toHaveBeenCalledTimes(8);
});
