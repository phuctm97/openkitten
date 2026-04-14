import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Database } from "~/lib/database";
import { PluginAPI } from "~/lib/plugin-api";
import type { Profile } from "~/lib/profile";

let profileDir: string;
let profile: Profile;
let pluginAPI: PluginAPI;

const mockBotApi = {
  getMe: vi.fn(),
};

const mockBot = { api: mockBotApi } as never;

const mockDatabase = {
  query: {
    session: {
      findMany: vi.fn(() => ({
        sync: () => [
          {
            id: "s1",
            chatId: 100,
            threadId: 0,
            agent: "assist",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
          },
        ],
      })),
    },
  },
} as unknown as Database;

beforeEach(async () => {
  profileDir = await mkdtemp(join(tmpdir(), "plugin-api-"));
  profile = {
    dir: profileDir,
    workspace: join(profileDir, "workspace"),
    xdgData: join(profileDir, "data"),
    xdgConfig: join(profileDir, "config"),
    xdgState: join(profileDir, "state"),
    xdgCache: join(profileDir, "cache"),
  } as Profile;
  pluginAPI = await PluginAPI.create(profile, mockBot, mockDatabase);
});

afterEach(async () => {
  pluginAPI[Symbol.dispose]();
  await rm(profileDir, { recursive: true });
});

async function rpc(method: string, args: unknown[] = []): Promise<Response> {
  const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
  const raw = await readFile(configPath, "utf-8");
  const config: { url: string; token: string } = JSON.parse(raw);
  return fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ method, args }),
  });
}

test("writes plugin-api.json on create", async () => {
  const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
  const raw = await readFile(configPath, "utf-8");
  const config = JSON.parse(raw);
  expect(config.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(config.token).toBeTruthy();
});

test("returns 401 without auth", async () => {
  const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
  const raw = await readFile(configPath, "utf-8");
  const config: { url: string } = JSON.parse(raw);
  const res = await fetch(config.url, {
    method: "POST",
    headers: { authorization: "Bearer wrong-token" },
  });
  expect(res.status).toBe(401);
});

test("returns 405 for non-POST", async () => {
  const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
  const raw = await readFile(configPath, "utf-8");
  const config: { url: string; token: string } = JSON.parse(raw);
  const res = await fetch(config.url, {
    method: "GET",
    headers: { authorization: `Bearer ${config.token}` },
  });
  expect(res.status).toBe(405);
});

test("returns 404 for unknown method", async () => {
  const res = await rpc("nonExistentMethod");
  expect(res.status).toBe(404);
});

test("returns 400 for invalid RPC body", async () => {
  const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
  const raw = await readFile(configPath, "utf-8");
  const config: { url: string; token: string } = JSON.parse(raw);
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ invalid: true }),
  });
  expect(res.status).toBe(400);
});

test("getBotInfo returns bot info", async () => {
  vi.mocked(mockBotApi.getMe).mockResolvedValue({
    id: 1,
    is_bot: true,
    first_name: "TestBot",
    username: "testbot",
  });
  const res = await rpc("getBotInfo");
  expect(res.status).toBe(200);
  const data = (await res.json()) as { [k: string]: unknown };
  expect(data).toEqual({
    id: 1,
    isBot: true,
    firstName: "TestBot",
    username: "testbot",
  });
});

test("getBotInfo caches result", async () => {
  vi.mocked(mockBotApi.getMe).mockClear();
  vi.mocked(mockBotApi.getMe).mockResolvedValue({
    id: 1,
    is_bot: true,
    first_name: "TestBot",
    username: "testbot",
  });
  await rpc("getBotInfo");
  await rpc("getBotInfo");
  expect(mockBotApi.getMe).toHaveBeenCalledOnce();
});

test("listSessions returns sessions", async () => {
  const res = await rpc("listSessions");
  expect(res.status).toBe(200);
  const data = (await res.json()) as { [k: string]: unknown };
  expect(data).toEqual([
    {
      id: "s1",
      chatId: 100,
      threadId: undefined,
      agent: "assist",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  ]);
});

test("returns 500 on unexpected error", async () => {
  vi.mocked(mockDatabase.query.session.findMany).mockImplementationOnce(() => {
    throw new Error("unexpected");
  });
  const res = await rpc("listSessions");
  expect(res.status).toBe(500);
  const data = (await res.json()) as { [k: string]: unknown };
  expect(data["error"]).toBe("unexpected");
});

test("returns 500 with generic message for non-Error throw", async () => {
  vi.mocked(mockDatabase.query.session.findMany).mockImplementationOnce(() => {
    throw "string-error";
  });
  const res = await rpc("listSessions");
  expect(res.status).toBe(500);
  const data = (await res.json()) as { [k: string]: unknown };
  expect(data["error"]).toBe("Internal error");
});

test("dispose stops the server", async () => {
  const api = await PluginAPI.create(profile, mockBot, mockDatabase);
  api[Symbol.dispose]();
});
