import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { password, select, spinner, text } from "@clack/prompts";
import { GrammyError } from "grammy";
import { beforeEach, expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import type { Profile } from "~/lib/profile";
import { TelegramConfig } from "~/lib/telegram-config";

vi.mock("~/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const cancelSymbol = Symbol("cancel");
const validToken = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

const isTTYMock = vi.hoisted(() => ({ isTTY: true }));
vi.mock("~/lib/is-tty", () => isTTYMock);

function mockSpinner(stop = vi.fn()) {
  return {
    start: vi.fn(),
    stop,
    message: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  };
}

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
  },
  password: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  spinner: vi.fn(() => mockSpinner()),
  isCancel: (value: unknown) => value === cancelSymbol,
}));

const { getMeMock, MockApi } = vi.hoisted(() => {
  const getMeMock = vi.fn();
  class MockApi {
    getMe = getMeMock;
  }
  return { getMeMock, MockApi };
});

vi.mock("grammy", async (importOriginal) => {
  const grammy = await importOriginal<typeof import("grammy")>();
  return { ...grammy, Api: MockApi };
});

let profile: Profile;
let configPath: string;

beforeEach(async () => {
  vi.clearAllMocks();
  isTTYMock.isTTY = true;
  const dir = await mkdtemp(join(tmpdir(), "openkitten-auth-test-"));
  profile = { xdgConfig: dir } as Profile;
  configPath = join(dir, "openkitten", "telegram.json");
  await mkdir(join(dir, "openkitten"), { recursive: true });
});

function mockGetMe(
  ok: boolean,
  result?: { first_name: string; username: string },
): void {
  if (ok) {
    getMeMock.mockResolvedValueOnce(result);
  } else {
    getMeMock.mockRejectedValueOnce(
      new GrammyError(
        "",
        { ok: false, error_code: 401, description: "" },
        "getMe",
        {},
      ),
    );
  }
}

test("loads valid config without TTY output", async () => {
  isTTYMock.isTTY = false;
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("loads valid config from file", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("prompts when config file does not exist", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(456);
});

test("saves config after prompting", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select).mockResolvedValueOnce("continue");
  const saved = await TelegramConfig.create(profile);
  expect(saved.botToken).toBe(validToken);
  expect(saved.userId).toBe(456);
});

test("prompts when config file has invalid data", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: "bad-format", userId: 123 }),
  );
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("789");
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(789);
});

test("prompts when config file has malformed JSON", async () => {
  await Bun.write(configPath, "not json");
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("prompts with password type for bot token", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
  expect(password).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Enter your bot token" }),
  );
});

test("prompts with text type for user ID", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
  expect(text).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Enter your user ID" }),
  );
});

test("throws when bot token prompt is cancelled", async () => {
  vi.mocked(password).mockResolvedValueOnce(cancelSymbol as never);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.CancelledError,
  );
});

test("throws when user ID prompt is cancelled", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce(cancelSymbol as never);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.CancelledError,
  );
});

test("throws when not a TTY", async () => {
  isTTYMock.isTTY = false;
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
});

test("throws when saved bot token is invalid in non-TTY", async () => {
  isTTYMock.isTTY = false;
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(false);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
  expect(logger.error).toHaveBeenCalled();
});

test("throws when config is unparseable in non-TTY", async () => {
  isTTYMock.isTTY = false;
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: "bad-format", userId: 123 }),
  );
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
  expect(logger.error).toHaveBeenCalled();
});

test("throws when config has malformed JSON in non-TTY", async () => {
  isTTYMock.isTTY = false;
  await Bun.write(configPath, "not json");
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
  expect(logger.error).toHaveBeenCalled();
});

test("rethrows non-GrammyError during saved config verification", async () => {
  const s = mockSpinner();
  vi.mocked(spinner).mockReturnValueOnce(s);
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  getMeMock.mockRejectedValueOnce(new Error("network failure"));
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    "network failure",
  );
  expect(s.error).toHaveBeenCalledWith("Failed to verify bot token");
});

test("rethrows non-GrammyError during saved config verification in non-TTY", async () => {
  isTTYMock.isTTY = false;
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  getMeMock.mockRejectedValueOnce(new Error("network failure"));
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    "network failure",
  );
});

test("re-prompts only bot token when saved token is invalid", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(false);
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(password).toHaveBeenCalled();
  expect(text).not.toHaveBeenCalled();
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("bot token validate rejects empty value", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("")).toBe(
      "Bot token must match <bot_id>:<bot_secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("bot token validate rejects invalid format", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("not-a-token")).toBe(
      "Bot token must match <bot_id>:<bot_secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("bot token validate accepts valid format", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.(validToken)).toBeUndefined();
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("user ID validate rejects non-integer", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("abc")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("user ID validate rejects zero", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("0")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("user ID validate rejects negative number", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("-1")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("user ID validate accepts positive integer", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("42")).toBeUndefined();
    return Promise.resolve("123");
  });
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
});

test("re-prompts bot token when API rejects it", async () => {
  vi.mocked(password)
    .mockResolvedValueOnce(validToken)
    .mockResolvedValueOnce(validToken);
  mockGetMe(false);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  const config = await TelegramConfig.create(profile);
  expect(password).toHaveBeenCalledTimes(2);
  expect(config.botToken).toBe(validToken);
});

test("shows spinner during bot token verification", async () => {
  const stopFn = vi.fn();
  vi.mocked(spinner).mockReturnValueOnce(mockSpinner(stopFn));
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "TestBot", username: "test_bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  vi.mocked(select).mockResolvedValueOnce("continue");
  await TelegramConfig.create(profile);
  expect(stopFn).toHaveBeenCalledWith(
    "Verified bot token: TestBot (@test_bot)",
  );
});

test("rethrows non-GrammyError from getMe", async () => {
  const s = mockSpinner();
  vi.mocked(spinner).mockReturnValueOnce(s);
  vi.mocked(password).mockResolvedValueOnce(validToken);
  getMeMock.mockRejectedValueOnce(new Error("network failure"));
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    "network failure",
  );
  expect(s.error).toHaveBeenCalledWith("Failed to verify bot token");
});

test("changes bot token via action loop", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select)
    .mockResolvedValueOnce("bot-token")
    .mockResolvedValueOnce("continue");
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "NewBot", username: "new_bot" });
  const config = await TelegramConfig.create(profile);
  expect(password).toHaveBeenCalled();
  expect(config.botToken).toBe(validToken);
});

test("changes user ID via action loop", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select)
    .mockResolvedValueOnce("user-id")
    .mockResolvedValueOnce("continue");
  vi.mocked(text).mockResolvedValueOnce("789");
  const config = await TelegramConfig.create(profile);
  expect(text).toHaveBeenCalled();
  expect(config.userId).toBe(789);
});

test("throws when action select is cancelled", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(select).mockResolvedValueOnce(cancelSymbol as never);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.CancelledError,
  );
});
