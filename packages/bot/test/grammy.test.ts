import { beforeEach, expect, test, vi } from "vitest";
import { Grammy } from "~/lib/grammy";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";

interface MockControls {
  resolveStopped: () => void;
}

let controls: MockControls;
let mockStart: ReturnType<typeof vi.fn>;
let mockStop: ReturnType<typeof vi.fn>;
let mockCatch: ReturnType<typeof vi.fn>;
let mockShutdown: Shutdown;

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
  mockShutdown = { trigger: vi.fn() } as never;
});

test("logs start and ready", async () => {
  await using _grammy = await Grammy.create(mockShutdown, createMockBot());
  expect(logger.debug).toHaveBeenCalledWith("grammY is starting…");
  expect(logger.info).toHaveBeenCalledWith("grammY is ready");
});

test("is async disposable", async () => {
  {
    await using _grammy = await Grammy.create(mockShutdown, createMockBot());
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(logger.info).toHaveBeenCalledWith("grammY is stopped");
});

test("propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(Grammy.create(mockShutdown, createMockBot())).rejects.toThrow(
    "polling failed",
  );
});

test("stopped rejects on unexpected stop", async () => {
  const grammy = await Grammy.create(mockShutdown, createMockBot());
  controls.resolveStopped();
  await expect(grammy.stopped).rejects.toThrow("grammY stopped unexpectedly");
});

test("catch handler logs error with chat and thread", async () => {
  await using _grammy = await Grammy.create(mockShutdown, createMockBot());
  expect(mockCatch).toHaveBeenCalledOnce();
  const [handler] = mockCatch.mock.calls[0] as [
    (err: {
      ctx: {
        chat?: { id: number };
        from?: { id: number };
        msg?: { message_thread_id?: number };
        update: { update_id: number };
      };
      error: unknown;
    }) => void,
  ];
  const error = new Error("unexpected");
  handler({
    ctx: {
      chat: { id: 123 },
      from: { id: 99 },
      msg: { message_thread_id: 456 },
      update: { update_id: 789 },
    },
    error,
  });
  expect(logger.fatal).toHaveBeenCalledWith(
    "grammY caught an unhandled error",
    error,
    {
      update: { update_id: 789 },
    },
  );
  expect(mockShutdown.trigger).toHaveBeenCalledOnce();
});

test("catch handler handles missing chat and msg", async () => {
  await using _grammy = await Grammy.create(mockShutdown, createMockBot());
  const [handler] = mockCatch.mock.calls[0] as [
    (err: {
      ctx: {
        chat?: { id: number };
        from?: { id: number };
        msg?: { message_thread_id?: number };
        update: { update_id: number };
      };
      error: unknown;
    }) => void,
  ];
  const error = new Error("unexpected");
  handler({ ctx: { update: { update_id: 1 } }, error });
  expect(logger.fatal).toHaveBeenCalledWith(
    "grammY caught an unhandled error",
    error,
    {
      update: { update_id: 1 },
    },
  );
  expect(mockShutdown.trigger).toHaveBeenCalledOnce();
});

test("dispose logs fatal and triggers shutdown when bot.stop fails", async () => {
  const error = new Error("stop failed");
  mockStop = vi.fn(() => {
    controls.resolveStopped();
    throw error;
  });
  let grammyStopped: Promise<void>;
  {
    await using grammy = await Grammy.create(mockShutdown, createMockBot());
    grammyStopped = grammy.stopped;
  }
  await expect(grammyStopped).resolves.toBeUndefined();
  expect(logger.fatal).toHaveBeenCalledWith("grammY failed to stop", error);
  expect(mockShutdown.trigger).toHaveBeenCalled();
});

test("stopped does not reject after dispose", async () => {
  let grammyStopped: Promise<void>;
  {
    await using grammy = await Grammy.create(mockShutdown, createMockBot());
    grammyStopped = grammy.stopped;
  }
  await expect(grammyStopped).resolves.toBeUndefined();
});
