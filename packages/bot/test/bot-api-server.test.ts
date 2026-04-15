import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBotClient } from "@openkitten/bot-client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { BotAPIServer } from "~/lib/bot-api-server";
import type { Profile } from "~/lib/profile";

const BOT_TOKEN = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

let profileDir: string;
let profile: Profile;
let server: BotAPIServer;

beforeEach(async () => {
  profileDir = await mkdtemp(join(tmpdir(), "bot-api-server-"));
  profile = {
    dir: profileDir,
    workspace: join(profileDir, "workspace"),
    xdgData: join(profileDir, "data"),
    xdgConfig: join(profileDir, "config"),
    xdgState: join(profileDir, "state"),
    xdgCache: join(profileDir, "cache"),
  } as Profile;
  server = await BotAPIServer.create(profile, BOT_TOKEN);
});

afterEach(async () => {
  server[Symbol.dispose]();
  await rm(profileDir, { recursive: true });
});

async function readConfig(): Promise<{ url: string; token: string }> {
  const configPath = join(profile.xdgState, "openkitten", "bot-api.json");
  const raw = await readFile(configPath, "utf-8");
  return JSON.parse(raw);
}

test("writes bot-api.json with url and token", async () => {
  const config = await readConfig();
  expect(config.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/rpc$/);
  expect(config.token).toBeTruthy();
});

test("getBotToken returns the bot token via oRPC client", async () => {
  const config = await readConfig();
  const client = createBotClient({ url: config.url, token: config.token });
  const result = await client.getBotToken();
  expect(result).toBe(BOT_TOKEN);
});

test("returns 401 without auth", async () => {
  const config = await readConfig();
  const res = await fetch(config.url, {
    method: "POST",
    headers: { authorization: "Bearer wrong-token" },
  });
  expect(res.status).toBe(401);
});

test("returns 404 for non-rpc path", async () => {
  const config = await readConfig();
  const baseUrl = config.url.replace(/\/rpc$/, "");
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${config.token}` },
  });
  expect(res.status).toBe(404);
});

test("dispose stops the server", async () => {
  const api = await BotAPIServer.create(profile, BOT_TOKEN);
  api[Symbol.dispose]();
});
