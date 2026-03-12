import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { createBot } from "~/lib/create-bot";

let capturedToken: string;
let mockStart: ReturnType<typeof vi.fn>;
let mockStop: ReturnType<typeof vi.fn>;

vi.mock("grammy", () => {
  class MockBot {
    constructor(token: string) {
      capturedToken = token;
      this.start = mockStart;
      this.stop = mockStop;
    }
    start = mockStart;
    stop = mockStop;
  }
  return { Bot: MockBot };
});

interface MockControls {
  rejectStopped: (error: Error) => void;
}

function setupMock(options?: { startError?: Error }): MockControls {
  capturedToken = "";
  const controls: MockControls = {
    rejectStopped: () => {},
  };
  let resolveStopped: () => void;
  mockStop = vi.fn(() => resolveStopped());
  mockStart = vi.fn(
    (opts?: { onStart?: () => void }) =>
      new Promise<void>((resolve, reject) => {
        resolveStopped = resolve;
        controls.rejectStopped = reject;
        if (options?.startError) {
          reject(options.startError);
          return;
        }
        opts?.onStart?.();
      }),
  );
  return controls;
}

test("createBot returns bot with client", async () => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  const bot = await createBot();
  expect(bot.client).toBeDefined();
  vi.unstubAllEnvs();
});

test("createBot passes token to grammy", async () => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "my-token");
  await createBot();
  expect(capturedToken).toBe("my-token");
  vi.unstubAllEnvs();
});

test("createBot throws if TELEGRAM_BOT_TOKEN is missing", async () => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  await expect(createBot()).rejects.toThrow("TELEGRAM_BOT_TOKEN is required");
  vi.unstubAllEnvs();
});

test("createBot logs ready", async () => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  await createBot();
  expect(consola.ready).toHaveBeenCalledWith("bot is ready");
  vi.unstubAllEnvs();
});

test("createBot is async disposable", async () => {
  setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  {
    await using _bot = await createBot();
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(consola.debug).toHaveBeenCalledWith("bot is stopped");
  vi.unstubAllEnvs();
});

test("createBot propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  await expect(createBot()).rejects.toThrow("polling failed");
  vi.unstubAllEnvs();
});

test("createBot tolerates polling error after startup", async () => {
  const controls = setupMock();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  await createBot();
  controls.rejectStopped(new Error("polling crashed"));
  // Flush microtask so the catch handler runs.
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllEnvs();
});
