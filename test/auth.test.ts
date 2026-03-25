import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { password, spinner, text } from "@clack/prompts";
import { GrammyError } from "grammy";
import { beforeEach, expect, test, vi } from "vitest";
import { Auth } from "~/lib/auth";

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

beforeEach(() => {
  vi.clearAllMocks();
  isTTYMock.isTTY = true;
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

async function tempAuthPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "openkitten-auth-test-"));
  return join(dir, "auth.json");
}

test("loads valid auth from file", async () => {
  const path = await tempAuthPath();
  await Bun.write(
    path,
    JSON.stringify({
      telegram: { botToken: validToken, userId: 123 },
    }),
  );
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe(validToken);
  expect(auth.telegram.userId).toBe(123);
});

test("prompts when auth file does not exist", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe(validToken);
  expect(auth.telegram.userId).toBe(456);
});

test("saves auth after prompting", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("456");
  await Auth.load(path);
  const saved = await Auth.load(path);
  expect(saved.telegram.botToken).toBe(validToken);
  expect(saved.telegram.userId).toBe(456);
});

test("prompts when auth file has invalid data", async () => {
  const path = await tempAuthPath();
  await Bun.write(
    path,
    JSON.stringify({ telegram: { botToken: "bad-format", userId: 123 } }),
  );
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("789");
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe(validToken);
  expect(auth.telegram.userId).toBe(789);
});

test("prompts with password type for bot token", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
  expect(password).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Telegram bot token:" }),
  );
});

test("prompts with text type for user ID", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
  expect(text).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Telegram user ID:" }),
  );
});

test("throws when bot token prompt is cancelled", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(cancelSymbol as never);
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("throws when user ID prompt is cancelled", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce(cancelSymbol as never);
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("throws when not a TTY", async () => {
  const path = await tempAuthPath();
  isTTYMock.isTTY = false;
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("bot token validate rejects empty value", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("")).toBe(
      "Telegram bot token must match <bot_id>:<secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
});

test("bot token validate rejects invalid format", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("not-a-token")).toBe(
      "Telegram bot token must match <bot_id>:<secret> format",
    );
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
});

test("bot token validate accepts valid format", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.(validToken)).toBeUndefined();
    return Promise.resolve(validToken);
  });
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
});

test("user ID validate rejects non-integer", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("abc")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate rejects zero", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("0")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate rejects negative number", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("-1")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate accepts positive integer", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("42")).toBeUndefined();
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("re-prompts bot token when API rejects it", async () => {
  const path = await tempAuthPath();
  vi.mocked(password)
    .mockResolvedValueOnce(validToken)
    .mockResolvedValueOnce(validToken);
  mockGetMe(false);
  mockGetMe(true, { first_name: "Bot", username: "bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  const auth = await Auth.load(path);
  expect(password).toHaveBeenCalledTimes(2);
  expect(auth.telegram.botToken).toBe(validToken);
});

test("shows spinner during bot token verification", async () => {
  const path = await tempAuthPath();
  const stopFn = vi.fn();
  vi.mocked(spinner).mockReturnValueOnce(mockSpinner(stopFn));
  vi.mocked(password).mockResolvedValueOnce(validToken);
  mockGetMe(true, { first_name: "TestBot", username: "test_bot" });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
  expect(stopFn).toHaveBeenCalledWith("Verified bot: TestBot (@test_bot)");
});

test("rethrows non-GrammyError from getMe", async () => {
  const path = await tempAuthPath();
  const stopFn = vi.fn();
  vi.mocked(spinner).mockReturnValueOnce(mockSpinner(stopFn));
  vi.mocked(password).mockResolvedValueOnce(validToken);
  getMeMock.mockRejectedValueOnce(new Error("network failure"));
  await expect(Auth.load(path)).rejects.toThrow("network failure");
  expect(stopFn).toHaveBeenCalledWith("Failed to verify bot token");
});
