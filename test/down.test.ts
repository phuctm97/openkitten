import { runCommand } from "citty";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { down } from "~/lib/down";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock-home",
}));

const confirmMock = vi.fn();

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  confirm: (...args: unknown[]) => confirmMock(...args),
  isCancel: (value: unknown) => typeof value === "symbol",
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

interface ShellResult {
  readonly exitCode: number;
}

function shellResult(exitCode: number): ShellResult {
  return { exitCode };
}

function chainable(result: ShellResult) {
  const chain = () =>
    Object.assign(Promise.resolve(result), {
      nothrow: chain,
      quiet: chain,
      exitCode: result.exitCode,
    });
  return chain();
}

let shellMock: ReturnType<typeof vi.fn>;
const originalShell = Bun.$;
const originalPlatform = process.platform;
const originalGetuid = process.getuid;

beforeEach(() => {
  vi.clearAllMocks();
  shellMock = vi.fn(() => chainable(shellResult(0)));
  Object.assign(Bun, { $: shellMock });
  Object.defineProperty(process, "platform", {
    value: "linux",
    writable: true,
  });
  Object.defineProperty(process, "getuid", {
    value: () => 1000,
    writable: true,
  });
  delete Bun.env["OPENKITTEN_PROFILE"];
  confirmMock.mockResolvedValue(true);
});

afterEach(() => {
  Object.assign(Bun, { $: originalShell });
  Object.defineProperty(process, "platform", { value: originalPlatform });
  Object.defineProperty(process, "getuid", { value: originalGetuid });
});

test("uninstalls on linux", async () => {
  const { rm } = await import("node:fs/promises");
  const clack = await import("@clack/prompts");
  await runCommand(down, { rawArgs: [] });
  expect(vi.mocked(clack.intro)).toHaveBeenCalledWith("Removal");
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "/mock-home/.config/systemd/user/openkitten-default-profile.service",
    { force: true },
  );
  expect(vi.mocked(clack.outro)).toHaveBeenCalledWith(
    "Your kitten has left the chat. 😿",
  );
});

test("uninstalls on darwin with default profile", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  const { rm } = await import("node:fs/promises");
  await runCommand(down, { rawArgs: [] });
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "/mock-home/Library/Logs/OpenKitten/com.openkitten.profiles.default.stdout.log",
    { force: true },
  );
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "/mock-home/Library/Logs/OpenKitten/com.openkitten.profiles.default.stderr.log",
    { force: true },
  );
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.default.plist",
    { force: true },
  );
});

test("uninstalls on darwin with custom profile", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: () => 501 });
  Bun.env["OPENKITTEN_PROFILE"] = "work";
  const { rm } = await import("node:fs/promises");
  await runCommand(down, { rawArgs: [] });
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "/mock-home/Library/LaunchAgents/com.openkitten.profiles.work.plist",
    { force: true },
  );
});

test("uninstalls on win32", async () => {
  Object.defineProperty(process, "platform", { value: "win32" });
  Object.defineProperty(process, "getuid", { value: undefined });
  process.env["LOCALAPPDATA"] = "C:\\MockLocal";
  const { rm } = await import("node:fs/promises");
  await runCommand(down, { rawArgs: [] });
  expect(vi.mocked(rm)).toHaveBeenCalledWith(
    "C:\\MockLocal\\OpenKitten\\Profiles\\default\\Logs",
    { recursive: true, force: true },
  );
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.note)).toHaveBeenCalledWith(
    "To reinstall:\n  bun . up",
    "Changed your mind?",
  );
});

test("cancels when user declines", async () => {
  confirmMock.mockResolvedValue(false);
  await runCommand(down, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith(
    "Phew! Your kitten lives another day. 🙀",
  );
  expect(vi.mocked(clack.outro)).not.toHaveBeenCalled();
});

test("cancels when user presses ctrl+c", async () => {
  confirmMock.mockResolvedValue(Symbol("cancel"));
  await runCommand(down, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith(
    "Phew! Your kitten lives another day. 🙀",
  );
  expect(vi.mocked(clack.outro)).not.toHaveBeenCalled();
});

test("throws on unsupported platform", async () => {
  Object.defineProperty(process, "platform", { value: "freebsd" });
  await expect(runCommand(down, { rawArgs: [] })).rejects.toThrow(
    "freebsd is not supported yet",
  );
});

test("throws when getuid is unavailable on darwin", async () => {
  Object.defineProperty(process, "platform", { value: "darwin" });
  Object.defineProperty(process, "getuid", { value: undefined });
  await expect(runCommand(down, { rawArgs: [] })).rejects.toThrow(
    "process.getuid is not available",
  );
});

test("shows reinstall note after uninstall", async () => {
  await runCommand(down, { rawArgs: [] });
  const clack = await import("@clack/prompts");
  expect(vi.mocked(clack.note)).toHaveBeenCalledWith(
    "To reinstall:\n  bun . up",
    "Changed your mind?",
  );
});
