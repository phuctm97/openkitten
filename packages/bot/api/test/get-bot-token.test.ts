import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mockGetBotToken = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("../lib/create-bot-client", () => ({
  createOpenKittenBotClient: () => mockCreateClient(),
}));

beforeEach(() => {
  mockCreateClient.mockImplementation(() =>
    Promise.resolve({ getBotToken: mockGetBotToken }),
  );
});

afterEach(() => {
  mockGetBotToken.mockReset();
  mockCreateClient.mockReset();
  vi.resetModules();
});

test("returns bot token from the API", async () => {
  mockGetBotToken.mockResolvedValue("bot-token-123");
  const { getBotToken } = await import("~/lib/get-bot-token");
  const token = await getBotToken();
  expect(token).toBe("bot-token-123");
  expect(mockGetBotToken).toHaveBeenCalledOnce();
});

test("reuses client on subsequent calls", async () => {
  mockGetBotToken.mockResolvedValue("reused-token");
  const { getBotToken } = await import("~/lib/get-bot-token");
  await getBotToken();
  await getBotToken();
  expect(mockCreateClient).toHaveBeenCalledOnce();
  expect(mockGetBotToken).toHaveBeenCalledTimes(2);
});

test("shares a single client across concurrent calls", async () => {
  mockGetBotToken.mockResolvedValue("token");
  const { getBotToken } = await import("~/lib/get-bot-token");
  await Promise.all([getBotToken(), getBotToken(), getBotToken()]);
  expect(mockCreateClient).toHaveBeenCalledOnce();
  expect(mockGetBotToken).toHaveBeenCalledTimes(3);
});

test("retries after a failed initialization", async () => {
  mockCreateClient.mockRejectedValueOnce(new Error("init failed"));
  mockGetBotToken.mockResolvedValue("recovered");
  const { getBotToken } = await import("~/lib/get-bot-token");
  await expect(getBotToken()).rejects.toThrow("init failed");
  const token = await getBotToken();
  expect(token).toBe("recovered");
  expect(mockCreateClient).toHaveBeenCalledTimes(2);
});
