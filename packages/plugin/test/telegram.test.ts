import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Api } from "grammy";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Telegram } from "../lib/telegram";

const validToken = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "telegram-"));
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

test("getToken returns bot token", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 42,
  });
  const token = await Telegram.getToken(configDir);
  expect(token).toBe(validToken);
});

test("createApi returns Api instance", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 42,
  });
  const api = await Telegram.createApi(configDir);
  expect(api).toBeInstanceOf(Api);
});

test("throws ConfigNotFoundError when config missing", async () => {
  const configDir = join(tmpDir, "nonexistent");
  await expect(Telegram.getToken(configDir)).rejects.toBeInstanceOf(
    Telegram.ConfigNotFoundError,
  );
});

test("ConfigNotFoundError has path property", () => {
  const err = new Telegram.ConfigNotFoundError("/test/path");
  expect(err.path).toBe("/test/path");
  expect(err.message).toContain("/test/path");
});

test("throws on invalid bot token", async () => {
  const configDir = await writeTelegramConfig({
    botToken: "bad-token",
    userId: 42,
  });
  await expect(Telegram.getToken(configDir)).rejects.toThrow();
});

test("throws on invalid userId", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 0,
  });
  await expect(Telegram.getToken(configDir)).rejects.toThrow();
});

test("uses XDG_CONFIG_HOME from env when no argument", async () => {
  const configDir = await writeTelegramConfig({
    botToken: validToken,
    userId: 42,
  });
  const original = Bun.env["XDG_CONFIG_HOME"];
  Bun.env["XDG_CONFIG_HOME"] = configDir;
  try {
    const token = await Telegram.getToken();
    expect(token).toBe(validToken);
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
    const token = await Telegram.getToken();
    expect(token).toBe(validToken);
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
    await expect(Telegram.getToken()).rejects.toBeInstanceOf(
      Telegram.ConfigNotFoundError,
    );
  } finally {
    Bun.env["XDG_CONFIG_HOME"] = originalConfig;
    Bun.env["HOME"] = originalHome;
  }
});
