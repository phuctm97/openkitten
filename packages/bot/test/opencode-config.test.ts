import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { autocomplete, cancel, isCancel, select } from "@clack/prompts";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Errors } from "~/lib/errors";
import { OpencodeConfig } from "~/lib/opencode-config";
import type { Profile } from "~/lib/profile";

vi.mock("~/lib/is-tty", () => ({ isTTY: false }));
vi.mock("@clack/prompts");

let profileDir: string;
let profile: Profile;
beforeEach(async () => {
  profileDir = await mkdtemp(join(tmpdir(), "opencode-"));
  profile = {
    dir: profileDir,
    workspace: join(profileDir, "workspace"),
    xdgData: join(profileDir, "data"),
    xdgConfig: join(profileDir, "config"),
    xdgState: join(profileDir, "state"),
    xdgCache: join(profileDir, "cache"),
  } as Profile;
});

afterEach(async () => {
  await rm(profileDir, { recursive: true });
});

const configDir = () => join(profileDir, ".opencode");

const pluginsDir = () => join(profile.xdgConfig, "opencode", "plugins");

const toolPrefix = "openkitten_";

const normalizePathPattern = (path: string) => path.replaceAll("\\", "/");

test("copies agent files", async () => {
  await OpencodeConfig.create(profile);
  await expect(
    readFile(join(configDir(), "agents", "assist.md"), "utf-8"),
  ).resolves.toBeDefined();
  await expect(
    readFile(join(configDir(), "agents", "build.md"), "utf-8"),
  ).resolves.toBeDefined();
  await expect(
    readFile(join(configDir(), "agents", "plan.md"), "utf-8"),
  ).resolves.toBeDefined();
});

test("renders agent files with self-file access", async () => {
  await OpencodeConfig.create(profile);
  const agentDirectoryGlob = normalizePathPattern(
    join(configDir(), "agents", "*"),
  );

  for (const agent of ["assist", "build", "plan"]) {
    const agentPath = join(configDir(), "agents", `${agent}.md`);
    const normalizedAgentPath = normalizePathPattern(agentPath);
    const content = await readFile(agentPath, "utf-8");
    expect(content).toContain(normalizedAgentPath);
    expect(content).toContain(
      `    ${JSON.stringify(normalizedAgentPath)}: allow`,
    );
    expect(content).toContain(
      `    ${JSON.stringify(agentDirectoryGlob)}: allow`,
    );
    expect(content).toContain("durable memory");
    expect(content).toContain("# Memory");
    expect(content).toContain("No durable memory recorded yet.");
    expect(content).not.toContain("__OPENKITTEN_AGENT_");
  }
});

test("writes opencode config", async () => {
  await OpencodeConfig.create(profile);
  const config = JSON.parse(
    await readFile(join(configDir(), "opencode.json"), "utf-8"),
  );
  expect(config.default_agent).toBe("assist");
});

test("writes system OpenCode plugin", async () => {
  await OpencodeConfig.create(profile);
  const content = await readFile(join(pluginsDir(), "openkitten.js"), "utf-8");
  expect(content).toContain('id: "openkitten"');
  expect(content).toContain("server: async () => ({");
  expect(content).toContain(
    '"tool.execute.before": async (input, output) => {',
  );
  expect(content).toContain(
    `if (!input.tool.startsWith(${JSON.stringify(toolPrefix)})) return;`,
  );
  expect(content).toContain(
    `throw new Error(\`Cannot attach __OPENKITTEN__ metadata to \${input.tool}: tool args must be a mutable object.\`);`,
  );
  expect(content).toContain("output.args.__OPENKITTEN__ = {");
  expect(content).toContain("sessionID: input.sessionID,");
  expect(content).toContain("callID: input.callID,");
  expect(content).toContain("};");
});

test("does not overwrite existing opencode config", async () => {
  await OpencodeConfig.create(profile);
  const configPath = join(configDir(), "opencode.json");
  await writeFile(configPath, JSON.stringify({ default_agent: "build" }));
  await OpencodeConfig.create(profile);
  const config = JSON.parse(await readFile(configPath, "utf-8"));
  expect(config.default_agent).toBe("build");
});

test("does not overwrite existing agent files", async () => {
  await OpencodeConfig.create(profile);
  const buildPath = join(configDir(), "agents", "build.md");
  await writeFile(buildPath, "custom content");
  await OpencodeConfig.create(profile);
  const content = await readFile(buildPath, "utf-8");
  expect(content).toBe("custom content");
});

test("copies new agents while preserving existing ones", async () => {
  await OpencodeConfig.create(profile);
  const buildPath = join(configDir(), "agents", "build.md");
  await writeFile(buildPath, "custom content");
  await OpencodeConfig.create(profile);
  const buildContent = await readFile(buildPath, "utf-8");
  expect(buildContent).toBe("custom content");
  const planPath = join(configDir(), "agents", "plan.md");
  const planContent = await readFile(planPath, "utf-8");
  expect(planContent).not.toBe("custom content");
});

test("overwrites existing system OpenCode plugin", async () => {
  await mkdir(pluginsDir(), { recursive: true });
  const pluginPath = join(pluginsDir(), "openkitten.js");
  await writeFile(pluginPath, "custom content");
  await OpencodeConfig.create(profile);
  const content = await readFile(pluginPath, "utf-8");
  expect(content).not.toBe("custom content");
  expect(content).toContain("output.args.__OPENKITTEN__ = {");
});

test("throws on single non-EEXIST error", async () => {
  await OpencodeConfig.create(profile);
  await rm(join(configDir(), "opencode.json"));
  await chmod(configDir(), 0o555);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toThrow();
  } finally {
    await chmod(configDir(), 0o755);
  }
});

test("throws Errors on multiple non-EEXIST errors", async () => {
  const agentsPath = join(configDir(), "agents");
  await mkdir(agentsPath, { recursive: true });
  await chmod(agentsPath, 0o444);
  await chmod(configDir(), 0o555);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(Errors);
  } finally {
    await chmod(configDir(), 0o755);
    await chmod(agentsPath, 0o755);
  }
});

test("returns bin path", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.bin).toBe(
    resolve(import.meta.dirname, "../node_modules/.bin/opencode"),
  );
});

test("returns cwd as profile workspace", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.cwd).toBe(profile.workspace);
});

test("returns xdg paths in env", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    XDG_DATA_HOME: profile.xdgData,
    XDG_CONFIG_HOME: profile.xdgConfig,
    XDG_STATE_HOME: profile.xdgState,
    XDG_CACHE_HOME: profile.xdgCache,
  });
});

test("returns opencode config dir in env", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_CONFIG_DIR: configDir(),
  });
});

test("injects default runtime OpenCode plugins", async () => {
  const config = await OpencodeConfig.create(profile);
  const runtimeConfigContent = config.env["OPENCODE_CONFIG_CONTENT"];
  expect(runtimeConfigContent).toBeDefined();
  if (runtimeConfigContent === undefined) {
    throw new Error("Expected OPENCODE_CONFIG_CONTENT to be defined");
  }
  const runtimeConfig = JSON.parse(runtimeConfigContent);
  expect(runtimeConfig.plugin).toEqual(["opencode-claude-auth"]);
});

test("disables autoupdate", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_DISABLE_AUTOUPDATE: "true",
  });
});

test("disables terminal title", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_DISABLE_TERMINAL_TITLE: "true",
  });
});

test("enables experimental models", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_ENABLE_EXPERIMENTAL_MODELS: "true",
  });
});

test("enables exa web search", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_ENABLE_EXA: "true",
  });
});

test("returns server credentials in env", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.env).toMatchObject({
    OPENCODE_SERVER_USERNAME: "openkitten",
    OPENCODE_SERVER_PASSWORD: expect.stringMatching(/^[\w-]{43}$/),
  });
});

test("returns basic authorization header", async () => {
  const config = await OpencodeConfig.create(profile);
  expect(config.authorization).toMatch(/^Basic /);
  const decoded = atob(config.authorization.slice(6));
  expect(decoded).toMatch(/^openkitten:/);
});

test("runs providers list when tty", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select).mockResolvedValue("continue");
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(0),
  })) as never);
  try {
    await OpencodeConfig.create(profile);
    expect(spawn).toHaveBeenCalledWith(
      [expect.stringContaining("opencode"), "providers", "list"],
      expect.objectContaining({
        stdio: ["inherit", "inherit", "inherit"],
      }),
    );
    expect(spawn).not.toHaveBeenCalledWith(
      [expect.stringContaining("opencode"), "providers", "login"],
      expect.anything(),
    );
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("skips action loop when skipActions is true", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(0),
  })) as never);
  try {
    await OpencodeConfig.create(profile, { skipActions: true });
    expect(select).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      [expect.stringContaining("opencode"), "providers", "list"],
      expect.objectContaining({
        stdio: ["inherit", "inherit", "inherit"],
      }),
    );
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("runs providers login when user selects add", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select)
    .mockResolvedValueOnce("add")
    .mockResolvedValueOnce("continue");
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(0),
  })) as never);
  try {
    await OpencodeConfig.create(profile);
    expect(spawn).toHaveBeenCalledWith(
      [expect.stringContaining("opencode"), "providers", "login"],
      expect.objectContaining({
        stdio: ["inherit", "inherit", "inherit"],
      }),
    );
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("runs providers logout when user selects remove", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select)
    .mockResolvedValueOnce("remove")
    .mockResolvedValueOnce("continue");
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(0),
  })) as never);
  try {
    await OpencodeConfig.create(profile);
    expect(spawn).toHaveBeenCalledWith(
      [expect.stringContaining("opencode"), "providers", "logout"],
      expect.objectContaining({
        stdio: ["inherit", "inherit", "inherit"],
      }),
    );
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("updates model in opencode.json when user selects change model", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select)
    .mockResolvedValueOnce("model")
    .mockResolvedValueOnce("continue");
  vi.mocked(autocomplete).mockResolvedValueOnce("anthropic/claude-opus-4");
  const modelsOutput = "anthropic/claude-opus-4\nanthropic/claude-sonnet-4\n";
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation(((
    args: string[],
  ) => ({
    exited: Promise.resolve(0),
    stdout: args.includes("models")
      ? new Response(modelsOutput).body
      : undefined,
  })) as never);
  try {
    await OpencodeConfig.create(profile);
    const configPath = join(configDir(), "opencode.json");
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.model).toBe("anthropic/claude-opus-4");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    vi.mocked(autocomplete).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when quiet list fails", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(1),
  })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when interactive list fails", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  const spawn = vi
    .spyOn(Bun, "spawn")
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(1) })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when add credential fails", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select).mockResolvedValue("add");
  const spawn = vi
    .spyOn(Bun, "spawn")
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(1) })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when remove credential fails", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select).mockResolvedValue("remove");
  const spawn = vi
    .spyOn(Bun, "spawn")
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(1) })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when models command fails", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  vi.mocked(select).mockResolvedValue("model");
  const spawn = vi
    .spyOn(Bun, "spawn")
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({ exited: Promise.resolve(0) })) as never)
    .mockImplementationOnce((() => ({
      exited: Promise.resolve(1),
      stdout: new Response("").body,
    })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when user cancels model select", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  const cancelSymbol = Symbol("cancel");
  vi.mocked(select).mockResolvedValueOnce("model");
  vi.mocked(autocomplete).mockResolvedValueOnce(cancelSymbol as never);
  vi.mocked(isCancel).mockReturnValueOnce(false).mockReturnValueOnce(true);
  const modelsOutput = "anthropic/claude-opus-4\n";
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation(((
    args: string[],
  ) => ({
    exited: Promise.resolve(0),
    stdout: args.includes("models")
      ? new Response(modelsOutput).body
      : undefined,
  })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    vi.mocked(autocomplete).mockReset();
    vi.mocked(isCancel).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});

test("throws CancelledError when user cancels select", async () => {
  const isTTYModule = await import("~/lib/is-tty");
  Object.defineProperty(isTTYModule, "isTTY", { value: true, writable: true });
  const cancelSymbol = Symbol("cancel");
  vi.mocked(select).mockResolvedValue(cancelSymbol as never);
  vi.mocked(isCancel).mockReturnValue(true);
  const spawn = vi.spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(0),
  })) as never);
  try {
    await expect(OpencodeConfig.create(profile)).rejects.toBeInstanceOf(
      OpencodeConfig.CancelledError,
    );
    expect(vi.mocked(cancel)).toHaveBeenCalledWith("Cancelled");
  } finally {
    spawn.mockRestore();
    vi.mocked(select).mockReset();
    vi.mocked(isCancel).mockReset();
    Object.defineProperty(isTTYModule, "isTTY", { value: false });
  }
});
