import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { readBotAPIConfig } from "~/lib/bot-api-config";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "bot-api-config-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

async function writeConfig(
  config: { url: string; token: string },
  stateDir?: string,
): Promise<string> {
  const dir = stateDir ?? join(tmpDir, "state");
  await mkdir(join(dir, "openkitten"), { recursive: true });
  await Bun.write(
    join(dir, "openkitten", "bot-api.json"),
    JSON.stringify(config),
  );
  return dir;
}

test("reads valid config", async () => {
  const stateDir = await writeConfig({
    url: "http://127.0.0.1:12345/rpc",
    token: "abc",
  });
  const config = await readBotAPIConfig(stateDir);
  expect(config.url).toBe("http://127.0.0.1:12345/rpc");
  expect(config.token).toBe("abc");
});

test("throws ConfigNotFoundError when config missing", async () => {
  await expect(
    readBotAPIConfig(join(tmpDir, "nonexistent")),
  ).rejects.toBeInstanceOf(readBotAPIConfig.ConfigNotFoundError);
});

test("ConfigNotFoundError has path property", () => {
  const err = new readBotAPIConfig.ConfigNotFoundError("/some/path");
  expect(err.path).toBe("/some/path");
  expect(err.message).toContain("/some/path");
});

test("throws on invalid config shape", async () => {
  const stateDir = join(tmpDir, "bad");
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "bot-api.json"),
    JSON.stringify({ invalid: true }),
  );
  await expect(readBotAPIConfig(stateDir)).rejects.toThrow();
});

test("uses XDG_STATE_HOME from env when no argument", async () => {
  const stateDir = await writeConfig({
    url: "http://127.0.0.1:9999/rpc",
    token: "xyz",
  });
  const original = Bun.env["XDG_STATE_HOME"];
  Bun.env["XDG_STATE_HOME"] = stateDir;
  try {
    const config = await readBotAPIConfig();
    expect(config.url).toBe("http://127.0.0.1:9999/rpc");
  } finally {
    Bun.env["XDG_STATE_HOME"] = original;
  }
});

test("falls back to HOME when XDG_STATE_HOME not set", async () => {
  const homeDir = join(tmpDir, "home");
  await writeConfig(
    { url: "http://127.0.0.1:8888/rpc", token: "t" },
    join(homeDir, ".local", "state"),
  );
  const originalState = Bun.env["XDG_STATE_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_STATE_HOME"] = undefined;
  Bun.env["HOME"] = homeDir;
  try {
    const config = await readBotAPIConfig();
    expect(config.url).toBe("http://127.0.0.1:8888/rpc");
  } finally {
    Bun.env["XDG_STATE_HOME"] = originalState;
    Bun.env["HOME"] = originalHome;
  }
});

test("falls back to empty string when both env vars unset", async () => {
  const originalState = Bun.env["XDG_STATE_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_STATE_HOME"] = undefined;
  Bun.env["HOME"] = undefined;
  try {
    await expect(readBotAPIConfig()).rejects.toBeInstanceOf(
      readBotAPIConfig.ConfigNotFoundError,
    );
  } finally {
    Bun.env["XDG_STATE_HOME"] = originalState;
    Bun.env["HOME"] = originalHome;
  }
});
