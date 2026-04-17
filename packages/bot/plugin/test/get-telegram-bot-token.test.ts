import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mockGetBotToken = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("../lib/create-bot-client", () => ({
  createOpenKittenBotClient: (...args: unknown[]) => {
    mockCreateClient(...args);
    return Promise.resolve({ getBotToken: mockGetBotToken });
  },
}));

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "get-telegram-bot-token-"));
});

afterEach(async () => {
  mockGetBotToken.mockReset();
  mockCreateClient.mockReset();
  vi.resetModules();
  await rm(tmpDir, { recursive: true });
});

test("returns bot token from the API", async () => {
  mockGetBotToken.mockResolvedValue("bot-token-123");
  const { getTelegramBotToken } = await import("~/lib/get-telegram-bot-token");
  const token = await getTelegramBotToken("/state");
  expect(token).toBe("bot-token-123");
  expect(mockGetBotToken).toHaveBeenCalledOnce();
});

test("reuses client on subsequent calls", async () => {
  mockGetBotToken.mockResolvedValue("reused-token");
  const { getTelegramBotToken } = await import("~/lib/get-telegram-bot-token");
  await getTelegramBotToken("/state");
  await getTelegramBotToken("/state");
  expect(mockCreateClient).toHaveBeenCalledOnce();
  expect(mockGetBotToken).toHaveBeenCalledTimes(2);
});

test("passes xdgState to createOpenKittenBotClient", async () => {
  mockGetBotToken.mockResolvedValue("token");
  const { getTelegramBotToken } = await import("~/lib/get-telegram-bot-token");
  await getTelegramBotToken("/custom/state");
  expect(mockCreateClient).toHaveBeenCalledWith("/custom/state");
});
