import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { password, spinner, text } from "@clack/prompts";
import { GrammyError } from "grammy";
import { beforeEach, expect, test, vi } from "vitest";
import type { Profile } from "~/lib/profile";
import { TelegramConfig } from "~/lib/telegram-config";

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
  log: { message: vi.fn() },
  password: vi.fn(),
  text: vi.fn(),
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
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("loads valid config from file", async () => {
  await Bun.write(
    configPath,
    JSON.stringify({ botToken: validToken, userId: 123 }),
  );
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(123);
});

test("prompts when config file does not exist", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(456);
});

test("saves config after prompting", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  await TelegramConfig.create(profile);
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
  const config = await TelegramConfig.create(profile);
  expect(config.botToken).toBe(validToken);
  expect(config.userId).toBe(789);
});

test("prompts with password type for bot token", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await TelegramConfig.create(profile);
  expect(password).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Telegram bot token:" }),
  );
});

test("prompts with text type for user ID", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await TelegramConfig.create(profile);
  expect(text).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Telegram user ID:" }),
  );
});

test("throws when bot token prompt is cancelled", async () => {
  vi.mocked(password).mockResolvedValueOnce(cancelSymbol as never);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
});

test("throws when user ID prompt is cancelled", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce(cancelSymbol as never);
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
});

test("throws when not a TTY", async () => {
  isTTYMock.isTTY = false;
  await expect(TelegramConfig.create(profile)).rejects.toThrow(
    TelegramConfig.NotFoundError,
  );
});

test("bot token validate rejects empty value", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("")).toBe(
      "Bot token must match <bot_id>:<secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await TelegramConfig.create(profile);
});

test("bot token validate rejects invalid format", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("not-a-token")).toBe(
      "Bot token must match <bot_id>:<secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await TelegramConfig.create(profile);
});

test("bot token validate accepts valid format", async () => {
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.(validToken)).toBeUndefined();
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await TelegramConfig.create(profile);
});

test("user ID validate rejects non-integer", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("abc")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await TelegramConfig.create(profile);
});

test("user ID validate rejects zero", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("0")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await TelegramConfig.create(profile);
});

test("user ID validate rejects negative number", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("-1")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await TelegramConfig.create(profile);
});

test("user ID validate accepts positive integer", async () => {
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("42")).toBeUndefined();
    return Promise.resolve("123");
  });
  await TelegramConfig.create(profile);
});

test("re-prompts bot token when API rejects it", async () => {
  vi.mocked(password)
    .mockResolvedValueOnce(validToken)
    .mockResolvedValueOnce(validToken);
  mockGetMe(false);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
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
  await TelegramConfig.create(profile);
  expect(stopFn).toHaveBeenCalledWith("Verified bot: TestBot (@test_bot)");
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
