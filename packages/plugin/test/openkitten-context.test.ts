import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Api } from "grammy";
import { afterEach, beforeEach, expect, test } from "vitest";
import { OpenkittenContext } from "../lib/openkitten-context";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "openkitten-ctx-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

async function writeTelegramConfig(
  config: { botToken: string; userId: number },
  xdgConfig?: string,
): Promise<string> {
  const configDir = xdgConfig ?? join(tmpDir, "config");
  await mkdir(join(configDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(configDir, "openkitten", "telegram.json"),
    JSON.stringify(config),
  );
  return configDir;
}

const validToken = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

test("creates context with valid config", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 42,
  });
  const ctx = await OpenkittenContext.create(configDir, join(tmpDir, "state"));
  expect(ctx.botToken).toBe(validToken);
  expect(ctx.userId).toBe(42);
  expect(ctx.telegram).toBeInstanceOf(Api);
  expect(ctx.api).toBeDefined();
  await expect(ctx.api.getBotInfo()).rejects.toThrow();
  await expect(ctx.api.listSessions()).rejects.toThrow();
});

test("throws ConfigNotFoundError when telegram.json missing", async () => {
  const configDir = join(tmpDir, "no-config");
  await expect(
    OpenkittenContext.create(configDir, join(tmpDir, "state")),
  ).rejects.toBeInstanceOf(OpenkittenContext.ConfigNotFoundError);
});

test("ConfigNotFoundError has path property", () => {
  const err = new OpenkittenContext.ConfigNotFoundError("/test/path");
  expect(err.path).toBe("/test/path");
  expect(err.message).toContain("/test/path");
});

test("throws on invalid bot token format", async () => {
  const configDir = await writeTelegramConfig({
    botToken: "invalid-token",
    userId: 42,
  });
  await expect(
    OpenkittenContext.create(configDir, join(tmpDir, "state")),
  ).rejects.toThrow();
});

test("throws on invalid userId", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: -1,
  });
  await expect(
    OpenkittenContext.create(configDir, join(tmpDir, "state")),
  ).rejects.toThrow();
});

test("uses XDG_CONFIG_HOME from env when no argument", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 42,
  });
  const original = Bun.env["XDG_CONFIG_HOME"];
  Bun.env["XDG_CONFIG_HOME"] = configDir;
  try {
    const ctx = await OpenkittenContext.create(
      undefined,
      join(tmpDir, "state"),
    );
    expect(ctx.botToken).toBe(validToken);
  } finally {
    Bun.env["XDG_CONFIG_HOME"] = original;
  }
});

test("falls back to HOME when XDG_CONFIG_HOME not set", async () => {
  const homeDir = join(tmpDir, "home");
  await writeTelegramConfig(
    { botToken: validToken, userId: 42 },
    join(homeDir, ".config"),
  );
  const originalConfig = Bun.env["XDG_CONFIG_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_CONFIG_HOME"] = undefined;
  Bun.env["HOME"] = homeDir;
  try {
    const ctx = await OpenkittenContext.create(
      undefined,
      join(tmpDir, "state"),
    );
    expect(ctx.botToken).toBe(validToken);
  } finally {
    Bun.env["XDG_CONFIG_HOME"] = originalConfig;
    Bun.env["HOME"] = originalHome;
  }
});

test("falls back to empty string when both XDG_CONFIG_HOME and HOME unset", async () => {
  const originalConfig = Bun.env["XDG_CONFIG_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_CONFIG_HOME"] = undefined;
  Bun.env["HOME"] = undefined;
  try {
    await expect(
      OpenkittenContext.create(undefined, join(tmpDir, "state")),
    ).rejects.toBeInstanceOf(OpenkittenContext.ConfigNotFoundError);
  } finally {
    Bun.env["XDG_CONFIG_HOME"] = originalConfig;
    Bun.env["HOME"] = originalHome;
  }
});
