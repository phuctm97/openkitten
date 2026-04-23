import { resolve } from "node:path";
import { runCommand } from "citty";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { up } from "~/lib/up";

vi.mock("~/lib/telegram-config", () => ({
  TelegramConfig: {
    create: vi.fn(async () => ({ botToken: "test-token", userId: 123 })),
  },
}));

vi.mock("~/lib/opencode-config", () => ({
  OpencodeConfig: { create: vi.fn() },
}));

vi.mock("~/lib/grammy-set-commands");

vi.mock("~/lib/list-command-files", () => ({
  listCommandFiles: vi.fn(async () => []),
}));

const { mockDatabaseCreate, mockDatabaseInsertValues, mockDatabaseSessions } =
  vi.hoisted(() => ({
    mockDatabaseCreate: vi.fn(),
    mockDatabaseInsertValues: vi.fn(),
    mockDatabaseSessions: [] as { chatId: number; threadId: number }[],
  }));

vi.mock("~/lib/database", () => ({
  Database: {
    create: mockDatabaseCreate,
  },
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock-home",
}));

vi.mock("node:util", () => ({
  styleText: (_style: string, text: string) => text,
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { warn: vi.fn() },
  note: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  taskLog: vi.fn(() => ({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

interface ShellResult {
  readonly exitCode: number;
  text(): Promise<string>;
}

function shellResult(exitCode: number, output = ""): ShellResult {
  return { exitCode, text: () => Promise.resolve(output) };
}

function chainable(result: ShellResult) {
  const chain = () =>
    Object.assign(Promise.resolve(result), {
      cwd: chain,
      nothrow: chain,
      quiet: chain,
      text: result.text,
      env: chain,
      exitCode: result.exitCode,
    });
  return chain();
}

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

let shellMock: ReturnType<typeof vi.fn>;
const originalShell = Bun.$;
const originalPlatform = process.platform;
const originalGetuid = process.getuid;
const botDir = resolve(import.meta.dirname, "..");

beforeEach(() => {
  shellMock = vi.fn(() => chainable(shellResult(0, "")));
  Object.assign(Bun, { $: shellMock });
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    stdout: emptyStream(),
    stderr: emptyStream(),
    exited: Promise.resolve(0),
  })) as never);
  vi.spyOn(Bun, "write").mockImplementation((() =>
    Promise.resolve(0)) as never);
  Object.defineProperty(process, "platform", {
    value: "linux",
    writable: true,
  });
  Object.defineProperty(process, "getuid", {
    value: () => 1000,
    writable: true,
  });
  delete Bun.env.OPENKITTEN_PROFILE;
  delete Bun.env.OPENKITTEN_ENABLE_UPGRADE;
  mockDatabaseSessions.length = 0;
  mockDatabaseInsertValues.mockReset();
  mockDatabaseInsertValues.mockReturnValue({ run: vi.fn() });
  mockDatabaseCreate.mockReset();
  mockDatabaseCreate.mockImplementation(() => ({
    query: {
      session: {
        findMany: () => ({ sync: () => [...mockDatabaseSessions] }),
      },
    },
    insert: () => ({ values: mockDatabaseInsertValues }),
    [Symbol.dispose]: vi.fn(),
  }));
});

afterEach(() => {
  Object.assign(Bun, { $: originalShell });
  Object.defineProperty(process, "platform", { value: originalPlatform });
  Object.defineProperty(process, "getuid", { value: originalGetuid });
  delete Bun.env.OPENKITTEN_ENABLE_UPGRADE;
});

test("installs on linux", async () => {
  const clack = await import("@clack/prompts");
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(clack.intro)).toHaveBeenCalledWith("Service");
  expect(vi.mocked(clack.outro)).toHaveBeenCalledWith(
    "Meow! Your kitten is up and running. 😻",
  );
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/.config/systemd/user/openkitten-default-profile.service",
    expect.stringContaining(`WorkingDirectory=${botDir}`),
  );
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/.config/systemd/user/openkitten-default-profile.service",
    expect.stringContaining("Environment=OPENKITTEN_ENABLE_UPGRADE=1"),
  );
});

test("passes yes option when yes flag is set", async () => {
  const { TelegramConfig } = await import("~/lib/telegram-config");
  const { OpencodeConfig } = await import("~/lib/opencode-config");
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes"] });
  expect(vi.mocked(TelegramConfig.create)).toHaveBeenCalledWith(
    expect.anything(),
    { skipActions: true },
  );
  expect(vi.mocked(OpencodeConfig.create)).toHaveBeenCalledWith(
    expect.anything(),
    { skipActions: true },
  );
});

test("restarts on linux when already running", async () => {
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  const spinnerInstance = vi.mocked(clack.spinner).mock.results[0]
    ?.value as ReturnType<typeof clack.spinner>;
  expect(spinnerInstance.stop).toHaveBeenCalledWith("Updated service");
});

test("installs on darwin with default profile", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  const { mkdir } = await import("node:fs/promises");
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(mkdir)).toHaveBeenCalled();
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.default.plist",
    expect.stringContaining(
      `<key>WorkingDirectory</key>\n  <string>${botDir}</string>`,
    ),
  );
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.default.plist",
    expect.stringContaining("<key>OPENKITTEN_ENABLE_UPGRADE</key>"),
  );
  const clack = await import("@clack/prompts");
  const spinnerInstance = vi.mocked(clack.spinner).mock.results[0]
    ?.value as ReturnType<typeof clack.spinner>;
  expect(spinnerInstance.stop).toHaveBeenCalledWith("Updated service");
});

test("installs on darwin with custom profile", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  Bun.env.OPENKITTEN_PROFILE = "work";
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.work.plist",
    expect.stringContaining(
      `<key>WorkingDirectory</key>\n  <string>${botDir}</string>`,
    ),
  );
});

test("restarts on darwin when already running", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  const clack = await import("@clack/prompts");
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  const spinnerInstance = vi.mocked(clack.spinner).mock.results[0]
    ?.value as ReturnType<typeof clack.spinner>;
  expect(spinnerInstance.stop).toHaveBeenCalledWith("Updated service");
});

test("proceeds after darwin bootout timeout", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  vi.spyOn(globalThis.Date, "now")
    .mockReturnValueOnce(0)
    .mockReturnValue(10_000);
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(Bun.write)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.default.plist",
    expect.stringContaining(
      `<key>WorkingDirectory</key>\n  <string>${botDir}</string>`,
    ),
  );
});

test("installs on win32", async () => {
  Object.defineProperty(process, "platform", { value: "win32" });
  Bun.env.LOCALAPPDATA = "C:\\MockLocal";
  const { mkdir } = await import("node:fs/promises");
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
    "C:\\MockLocal\\OpenKitten\\Profiles\\default\\Logs",
    { recursive: true },
  );
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.note)).toHaveBeenCalledWith(
    expect.stringContaining("stderr.log"),
    "Next steps",
  );
  expect(shellMock.mock.lastCall?.[2]).toContain(`cd /D \\"${botDir}\\"`);
  expect(shellMock.mock.lastCall?.[2]).toContain(
    "set OPENKITTEN_ENABLE_UPGRADE=1",
  );
});

test("skips pull but installs when not on main branch", async () => {
  shellMock.mockReturnValueOnce(chainable(shellResult(0, "feature\n")));
  await runCommand(up, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.log.warn)).toHaveBeenCalledWith(
    expect.stringContaining("Non-main branch"),
  );
  expect(vi.mocked(Bun.spawn)).toHaveBeenCalledWith(
    ["bun", "install"],
    expect.anything(),
  );
  expect(vi.mocked(Bun.spawn)).not.toHaveBeenCalledWith(
    ["git", "pull"],
    expect.anything(),
  );
});

test("skips pull but installs when worktree is dirty", async () => {
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, " M file.ts\n")));
  await runCommand(up, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.log.warn)).toHaveBeenCalledWith(
    expect.stringContaining("Dirty worktree"),
  );
  expect(vi.mocked(Bun.spawn)).toHaveBeenCalledWith(
    ["bun", "install"],
    expect.anything(),
  );
  expect(vi.mocked(Bun.spawn)).not.toHaveBeenCalledWith(
    ["git", "pull"],
    expect.anything(),
  );
});

test("throws on runTask failure", async () => {
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")));
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    stdout: emptyStream(),
    stderr: emptyStream(),
    exited: Promise.resolve(1),
  })) as never);
  await expect(runCommand(up, { rawArgs: [] })).rejects.toThrow(
    "exited with code 1",
  );
});

test("throws on unsupported platform", async () => {
  Object.defineProperty(process, "platform", { value: "freebsd" });
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")));
  await expect(runCommand(up, { rawArgs: [] })).rejects.toThrow(
    "freebsd is not supported yet",
  );
});

test("throws when getuid is unavailable on darwin", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: undefined });
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")));
  await expect(runCommand(up, { rawArgs: [] })).rejects.toThrow(
    "process.getuid is not available",
  );
});

test("runTask forwards stdout and stderr", async () => {
  const clack = await import("@clack/prompts");
  const taskLogMessage = vi.fn();
  vi.mocked(clack.taskLog).mockReturnValue({
    message: taskLogMessage,
    group: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  });
  const encode = (s: string) => new TextEncoder().encode(s);
  vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(encode("out line\n"));
        controller.close();
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        controller.enqueue(encode("err line\n"));
        controller.close();
      },
    }),
    exited: Promise.resolve(0),
  })) as never);
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")));
  await runCommand(up, { rawArgs: [] });
  expect(taskLogMessage).toHaveBeenCalledWith("out line");
  expect(taskLogMessage).toHaveBeenCalledWith("err line");
});

test("pushes builtin commands plus listCommandFiles output to Telegram", async () => {
  const { listCommandFiles } = await import("~/lib/list-command-files");
  vi.mocked(listCommandFiles).mockResolvedValueOnce([
    { command: "weather", description: "Check the weather" },
  ]);
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  expect(vi.mocked(listCommandFiles)).toHaveBeenCalledWith(
    "/mock-home/.openkitten/profiles/default/.opencode/commands",
  );
  const { grammySetCommands } = await import("~/lib/grammy-set-commands");
  expect(vi.mocked(grammySetCommands)).toHaveBeenCalledWith(
    "test-token",
    expect.arrayContaining([
      { command: "weather", description: "Check the weather" },
    ]),
  );
});

test("--notify-restart writes '✅ OpenKitten upgraded' when git pull changes HEAD", async () => {
  mockDatabaseSessions.push(
    { chatId: 100, threadId: 0 },
    { chatId: 200, threadId: 7 },
  );
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes", "--notify-restart"] });
  expect(mockDatabaseInsertValues).toHaveBeenNthCalledWith(1, {
    chatId: 100,
    threadId: 0,
    message: "✅ OpenKitten upgraded",
  });
  expect(mockDatabaseInsertValues).toHaveBeenNthCalledWith(2, {
    chatId: 200,
    threadId: 7,
    message: "✅ OpenKitten upgraded",
  });
});

test("--notify-restart writes 'already on the latest version' when git pull finds nothing new", async () => {
  mockDatabaseSessions.push({ chatId: 300, threadId: 0 });
  const sameSha = "abc123\n";
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, sameSha)))
    .mockReturnValueOnce(chainable(shellResult(0, sameSha)))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes", "--notify-restart"] });
  expect(mockDatabaseInsertValues).toHaveBeenCalledWith({
    chatId: 300,
    threadId: 0,
    message: "ℹ️ OpenKitten is already on the latest version",
  });
});

test("--notify-restart writes 'upgrade skipped: dirty' when the working tree is dirty", async () => {
  mockDatabaseSessions.push({ chatId: 400, threadId: 0 });
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, " M file.ts\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes", "--notify-restart"] });
  expect(mockDatabaseInsertValues).toHaveBeenCalledWith({
    chatId: 400,
    threadId: 0,
    message: "⚠️ Upgrade skipped: working tree has uncommitted changes",
  });
});

test("--notify-restart writes 'upgrade skipped: non-main' when not on main", async () => {
  mockDatabaseSessions.push({ chatId: 500, threadId: 0 });
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "feature\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes", "--notify-restart"] });
  expect(mockDatabaseInsertValues).toHaveBeenCalledWith({
    chatId: 500,
    threadId: 0,
    message: "⚠️ Upgrade skipped: not on main branch",
  });
});

test("--notify-restart writes nothing when no sessions exist", async () => {
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes", "--notify-restart"] });
  expect(mockDatabaseInsertValues).not.toHaveBeenCalled();
});

test("without --notify-restart, the database is not opened and no notifications are written", async () => {
  mockDatabaseSessions.push({ chatId: 600, threadId: 0 });
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(0, "abc123\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "def456\n")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: ["--yes"] });
  expect(mockDatabaseCreate).not.toHaveBeenCalled();
  expect(mockDatabaseInsertValues).not.toHaveBeenCalled();
});

test("pushes only builtin commands when commands dir is empty", async () => {
  const { listCommandFiles } = await import("~/lib/list-command-files");
  vi.mocked(listCommandFiles).mockResolvedValueOnce([]);
  shellMock
    .mockReturnValueOnce(chainable(shellResult(0, "main\n")))
    .mockReturnValueOnce(chainable(shellResult(0, "")))
    .mockReturnValueOnce(chainable(shellResult(1)))
    .mockReturnValueOnce(chainable(shellResult(0)))
    .mockReturnValueOnce(chainable(shellResult(0)));
  await runCommand(up, { rawArgs: [] });
  const { grammySetCommands } = await import("~/lib/grammy-set-commands");
  const call = vi.mocked(grammySetCommands).mock.calls[0];
  if (!call) throw new Error("Expected grammySetCommands to be called");
  expect(call[1].map((c) => c.command)).toEqual([
    "start",
    "abort",
    "compact",
    "agent",
    "upgrade",
  ]);
});
