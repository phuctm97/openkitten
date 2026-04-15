import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { definePlugin } from "../lib/define-plugin";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "define-plugin-"));
  const stateDir = join(tmpDir, "state");
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify({ url: "http://127.0.0.1:12345/rpc", token: "test-token" }),
  );
  Bun.env["XDG_STATE_HOME"] = stateDir;
});

afterEach(async () => {
  vi.restoreAllMocks();
  Bun.env["XDG_STATE_HOME"] = undefined;
  await rm(tmpDir, { recursive: true });
});

const fakeOpencode = {
  client: {} as PluginInput["client"],
  project: {} as PluginInput["project"],
  directory: "/test",
  worktree: "/test",
  serverUrl: new URL("http://localhost:3000"),
  $: (() => {}) as never,
} satisfies PluginInput;

test("returns a PluginModule with correct id", () => {
  const plugin = definePlugin("test-plugin", async () => ({}));
  expect(plugin.id).toBe("test-plugin");
  expect(typeof plugin.server).toBe("function");
});

test("server calls factory with opencode and openkitten", async () => {
  const factory = vi.fn(async () => ({}) as Hooks);
  const plugin = definePlugin("test", factory);
  await plugin.server(fakeOpencode);
  expect(factory).toHaveBeenCalledOnce();
  const call = factory.mock.calls[0] as never as [definePlugin.Input, unknown];
  expect(call[0].opencode).toBe(fakeOpencode);
  expect(call[0].openkitten.api).toBeDefined();
});

test("server passes options to factory", async () => {
  const factory = vi.fn(async () => ({}) as Hooks);
  const plugin = definePlugin("test", factory);
  const options = { debug: true };
  await plugin.server(fakeOpencode, options);
  const call = factory.mock.calls[0] as never as [unknown, unknown];
  expect(call[1]).toBe(options);
});

test("returns hooks from factory", async () => {
  const hooks: Hooks = {
    "tool.execute.before": async () => {},
  };
  const plugin = definePlugin("test", async () => hooks);
  const result = await plugin.server(fakeOpencode);
  expect(result).toBe(hooks);
});
