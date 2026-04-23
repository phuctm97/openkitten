import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { readBotAPIConfig } from "~/lib/bot-api-config";

let tmpDir: string;
let originalXdgState: string | undefined;
let originalHome: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "bot-api-config-"));
  originalXdgState = Bun.env.XDG_STATE_HOME;
  originalHome = Bun.env.HOME;
});

afterEach(async () => {
  Bun.env.XDG_STATE_HOME = originalXdgState;
  Bun.env.HOME = originalHome;
  await rm(tmpDir, { recursive: true });
});

async function writeConfig(
  config: { url: string; token: string },
  stateDir: string,
): Promise<void> {
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify(config),
  );
}

test("reads valid config from XDG_STATE_HOME", async () => {
  const stateDir = join(tmpDir, "state");
  await writeConfig(
    { url: "http://127.0.0.1:12345/rpc", token: "abc" },
    stateDir,
  );
  Bun.env.XDG_STATE_HOME = stateDir;
  const config = await readBotAPIConfig();
  expect(config.url).toBe("http://127.0.0.1:12345/rpc");
  expect(config.token).toBe("abc");
});

test("throws when config file is missing", async () => {
  Bun.env.XDG_STATE_HOME = join(tmpDir, "nonexistent");
  await expect(readBotAPIConfig()).rejects.toThrow();
});

test("throws on invalid config shape", async () => {
  const stateDir = join(tmpDir, "bad");
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify({ invalid: true }),
  );
  Bun.env.XDG_STATE_HOME = stateDir;
  await expect(readBotAPIConfig()).rejects.toThrow();
});

test("falls back to HOME when XDG_STATE_HOME not set", async () => {
  const homeDir = join(tmpDir, "home");
  await writeConfig(
    { url: "http://127.0.0.1:8888/rpc", token: "t" },
    join(homeDir, ".local", "state"),
  );
  Bun.env.XDG_STATE_HOME = undefined;
  Bun.env.HOME = homeDir;
  const config = await readBotAPIConfig();
  expect(config.url).toBe("http://127.0.0.1:8888/rpc");
});

test("throws when both env vars unset", async () => {
  Bun.env.XDG_STATE_HOME = undefined;
  Bun.env.HOME = undefined;
  await expect(readBotAPIConfig()).rejects.toThrow();
});
