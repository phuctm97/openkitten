import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isTTY, password, text } from "@clack/prompts";
import { beforeEach, expect, test, vi } from "vitest";
import { Auth } from "~/lib/auth";

const cancelSymbol = Symbol("cancel");

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  password: vi.fn(),
  text: vi.fn(),
  isCancel: (value: unknown) => value === cancelSymbol,
  isTTY: vi.fn(() => true),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function tempAuthPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "openkitten-auth-test-"));
  return join(dir, "auth.json");
}

test("loads valid auth from file", async () => {
  const path = await tempAuthPath();
  await Bun.write(
    path,
    JSON.stringify({
      telegram: { botToken: "test-token", userId: 123 },
    }),
  );
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe("test-token");
  expect(auth.telegram.userId).toBe(123);
});

test("prompts when auth file does not exist", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("prompted-token");
  vi.mocked(text).mockResolvedValueOnce("456");
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe("prompted-token");
  expect(auth.telegram.userId).toBe(456);
});

test("saves auth after prompting", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("prompted-token");
  vi.mocked(text).mockResolvedValueOnce("456");
  await Auth.load(path);
  const saved = await Auth.load(path);
  expect(saved.telegram.botToken).toBe("prompted-token");
  expect(saved.telegram.userId).toBe(456);
});

test("prompts when auth file has invalid data", async () => {
  const path = await tempAuthPath();
  await Bun.write(path, JSON.stringify({ telegram: { botToken: "" } }));
  vi.mocked(password).mockResolvedValueOnce("fixed-token");
  vi.mocked(text).mockResolvedValueOnce("789");
  const auth = await Auth.load(path);
  expect(auth.telegram.botToken).toBe("fixed-token");
  expect(auth.telegram.userId).toBe(789);
});

test("prompts with password type for bot token", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
  expect(password).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Telegram bot token:" }),
  );
});

test("prompts with text type for user ID", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
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
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockResolvedValueOnce(cancelSymbol as never);
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("throws when stdin is not a TTY", async () => {
  const path = await tempAuthPath();
  vi.mocked(isTTY).mockReturnValueOnce(false);
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("throws when stdout is not a TTY", async () => {
  const path = await tempAuthPath();
  vi.mocked(isTTY).mockReturnValueOnce(true).mockReturnValueOnce(false);
  await expect(Auth.load(path)).rejects.toThrow(Auth.NotFoundError);
});

test("bot token validate rejects empty value", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("")).toBe("Bot token is required");
    return Promise.resolve("token");
  });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
});

test("bot token validate accepts non-empty value", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockImplementationOnce(({ validate }) => {
    expect(validate?.("valid-token")).toBeUndefined();
    return Promise.resolve("token");
  });
  vi.mocked(text).mockResolvedValueOnce("123");
  await Auth.load(path);
});

test("user ID validate rejects non-integer", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("abc")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate rejects zero", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("0")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate rejects negative number", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("-1")).toBe("User ID must be a positive integer");
    return Promise.resolve("123");
  });
  await Auth.load(path);
});

test("user ID validate accepts positive integer", async () => {
  const path = await tempAuthPath();
  vi.mocked(password).mockResolvedValueOnce("token");
  vi.mocked(text).mockImplementationOnce(({ validate }) => {
    expect(validate?.("42")).toBeUndefined();
    return Promise.resolve("123");
  });
  await Auth.load(path);
});
