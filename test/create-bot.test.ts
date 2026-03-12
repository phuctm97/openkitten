import { consola } from "consola";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createBot } from "~/lib/create-bot";

let capturedToken: string;
let mockStart: ReturnType<typeof vi.fn>;
let mockStop: ReturnType<typeof vi.fn>;
let mockCatch: ReturnType<typeof vi.fn>;

vi.mock("grammy", () => {
  class MockBot {
    declare start: typeof mockStart;
    declare stop: typeof mockStop;
    declare catch: typeof mockCatch;
    constructor(token: string) {
      capturedToken = token;
      this.start = mockStart;
      this.stop = mockStop;
      this.catch = mockCatch;
    }
  }
  return { Bot: MockBot };
});

interface MockControls {
  resolveStopped: () => void;
  rejectStopped: (error: Error) => void;
}

let controls: MockControls;

function setupMock(options?: { startError?: Error }): void {
  capturedToken = "";
  controls = {
    resolveStopped: () => {},
    rejectStopped: () => {},
  };
  let resolveStopped: () => void;
  mockCatch = vi.fn();
  mockStop = vi.fn(() => resolveStopped());
  mockStart = vi.fn(
    (opts?: { onStart?: () => void }) =>
      new Promise<void>((resolve, reject) => {
        resolveStopped = resolve;
        controls.resolveStopped = resolve;
        controls.rejectStopped = reject;
        if (options?.startError) {
          reject(options.startError);
          return;
        }
        opts?.onStart?.();
      }),
  );
}

beforeEach(() => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("createBot returns bot with client", async () => {
  const bot = await createBot();
  expect(bot.client).toBeDefined();
});

test("createBot passes token to grammy", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "my-token");
  await createBot();
  expect(capturedToken).toBe("my-token");
});

test("createBot throws if TELEGRAM_BOT_TOKEN is missing", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  await expect(createBot()).rejects.toThrow("TELEGRAM_BOT_TOKEN is required");
});

test("createBot logs ready", async () => {
  await createBot();
  expect(consola.ready).toHaveBeenCalledWith("bot is ready");
});

test("createBot is async disposable", async () => {
  {
    await using _bot = await createBot();
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(consola.debug).toHaveBeenCalledWith("bot is stopped");
});

test("createBot propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(createBot()).rejects.toThrow("polling failed");
});

test("createBot.stopped rejects on unexpected stop", async () => {
  const bot = await createBot();
  controls.resolveStopped();
  await expect(bot.stopped).rejects.toThrow("bot stopped unexpectedly");
});

test("createBot installs fatal error handler", async () => {
  await createBot();
  expect(mockCatch).toHaveBeenCalledOnce();
  const [handler] = mockCatch.mock.calls[0] as [(error: unknown) => void];
  const error = new Error("unexpected");
  handler(error);
  expect(consola.fatal).toHaveBeenCalledWith("bot caught an error", error);
});

test("createBot.stopped does not reject after dispose", async () => {
  let botStopped: Promise<void>;
  {
    await using bot = await createBot();
    botStopped = bot.stopped;
  }
  await expect(botStopped).resolves.toBeUndefined();
});
