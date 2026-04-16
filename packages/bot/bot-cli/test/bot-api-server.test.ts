import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createOpenKittenBotClient,
  readBotAPIConfig,
} from "@openkitten/bot-plugin";
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

test("writes bot-api.json with url and token", async () => {
  const config = await readBotAPIConfig(profile.xdgState);
  expect(config.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/rpc$/);
  expect(config.token).toBeTruthy();
});

test("getBotToken returns the bot token via oRPC client", async () => {
  const client = await createOpenKittenBotClient(profile.xdgState);
  const result = await client.getBotToken();
  expect(result).toBe(BOT_TOKEN);
});

test("returns 401 without auth", async () => {
  const config = await readBotAPIConfig(profile.xdgState);
  const res = await fetch(config.url, {
    method: "POST",
    headers: { authorization: "Bearer wrong-token" },
  });
  expect(res.status).toBe(401);
});

test("returns 404 for non-rpc path", async () => {
  const config = await readBotAPIConfig(profile.xdgState);
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
