import { consola } from "consola";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createGrammy } from "~/lib/create-grammy";

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

test("returns bot", async () => {
  await using grammy = await createGrammy();
  expect(grammy.bot).toBeDefined();
});

test("passes token to grammy", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "my-token");
  await using _grammy = await createGrammy();
  expect(capturedToken).toBe("my-token");
});

test("throws if TELEGRAM_BOT_TOKEN is missing", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  await expect(createGrammy()).rejects.toThrow(
    "TELEGRAM_BOT_TOKEN is required",
  );
});

test("logs ready", async () => {
  await using _grammy = await createGrammy();
  expect(consola.ready).toHaveBeenCalledWith("grammy is ready");
});

test("is async disposable", async () => {
  {
    await using _grammy = await createGrammy();
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(consola.debug).toHaveBeenCalledWith("grammy is stopped");
});

test("propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(createGrammy()).rejects.toThrow("polling failed");
});

test("stopped rejects on unexpected stop", async () => {
  const grammy = await createGrammy();
  controls.resolveStopped();
  await expect(grammy.stopped).rejects.toThrow("grammy stopped unexpectedly");
});

test("installs fatal error handler", async () => {
  await using _grammy = await createGrammy();
  expect(mockCatch).toHaveBeenCalledOnce();
  const [handler] = mockCatch.mock.calls[0] as [(error: unknown) => void];
  const error = new Error("unexpected");
  handler(error);
  expect(consola.fatal).toHaveBeenCalledWith("grammy catch error", error);
});

test("stopped does not reject after dispose", async () => {
  let grammyStopped: Promise<void>;
  {
    await using grammy = await createGrammy();
    grammyStopped = grammy.stopped;
  }
  await expect(grammyStopped).resolves.toBeUndefined();
});
