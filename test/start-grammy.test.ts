import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import { startGrammy } from "~/lib/start-grammy";

interface MockControls {
  resolveStopped: () => void;
}

let controls: MockControls;
let mockStart: ReturnType<typeof vi.fn>;
let mockStop: ReturnType<typeof vi.fn>;
let mockCatch: ReturnType<typeof vi.fn>;

function setupMock(options?: { startError?: Error }): void {
  controls = {
    resolveStopped: () => {},
  };
  let resolveStopped: () => void;
  mockCatch = vi.fn();
  mockStop = vi.fn(() => resolveStopped());
  mockStart = vi.fn(
    (opts?: { onStart?: () => void }) =>
      new Promise<void>((resolve, reject) => {
        resolveStopped = resolve;
        controls.resolveStopped = resolve;
        if (options?.startError) {
          reject(options.startError);
          return;
        }
        opts?.onStart?.();
      }),
  );
}

function createMockBot() {
  return {
    start: mockStart,
    stop: mockStop,
    catch: mockCatch,
  } as never;
}

beforeEach(() => {
  setupMock();
});

test("logs ready", async () => {
  await using _grammy = await startGrammy(createMockBot());
  expect(consola.ready).toHaveBeenCalledWith("grammy is ready");
});

test("is async disposable", async () => {
  {
    await using _grammy = await startGrammy(createMockBot());
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(consola.debug).toHaveBeenCalledWith("grammy is stopped");
});

test("propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(startGrammy(createMockBot())).rejects.toThrow("polling failed");
});

test("stopped rejects on unexpected stop", async () => {
  const grammy = await startGrammy(createMockBot());
  controls.resolveStopped();
  await expect(grammy.stopped).rejects.toThrow("grammy stopped unexpectedly");
});

test("installs fatal error handler", async () => {
  await using _grammy = await startGrammy(createMockBot());
  expect(mockCatch).toHaveBeenCalledOnce();
  const [handler] = mockCatch.mock.calls[0] as [(error: unknown) => void];
  const error = new Error("unexpected");
  handler(error);
  expect(consola.fatal).toHaveBeenCalledWith("grammy catch error", error);
});

test("stopped does not reject after dispose", async () => {
  let grammyStopped: Promise<void>;
  {
    await using grammy = await startGrammy(createMockBot());
    grammyStopped = grammy.stopped;
  }
  await expect(grammyStopped).resolves.toBeUndefined();
});
