import { beforeEach, expect, test, vi } from "vitest";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";

interface MockControls {
  resolveClosed: () => void;
}

let controls: MockControls;
let mockStart: ReturnType<typeof vi.fn>;
let mockStop: ReturnType<typeof vi.fn>;
let mockCatch: ReturnType<typeof vi.fn>;
let mockShutdown: Shutdown;

function setupMock(options?: { startError?: Error }): void {
  controls = {
    resolveClosed: () => {},
  };
  let resolveClosed: () => void;
  mockCatch = vi.fn();
  mockStop = vi.fn(() => resolveClosed());
  mockStart = vi.fn(
    (opts?: { onStart?: () => void }) =>
      new Promise<void>((resolve, reject) => {
        resolveClosed = resolve;
        controls.resolveClosed = resolve;
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

test("logs connecting and connected", async () => {
  await using _grammyEventStream = await GrammyEventStream.create(
    mockShutdown,
    createMockBot(),
  );
  expect(logger.debug).toHaveBeenCalledWith(
    "grammY event stream is connecting…",
  );
  expect(logger.info).toHaveBeenCalledWith("grammY event stream is connected");
});

test("is async disposable", async () => {
  {
    await using _grammyEventStream = await GrammyEventStream.create(
      mockShutdown,
      createMockBot(),
    );
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(logger.info).toHaveBeenCalledWith("grammY event stream is closed");
});

test("propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(
    GrammyEventStream.create(mockShutdown, createMockBot()),
  ).rejects.toThrow("polling failed");
});

test("closed rejects on unexpected end", async () => {
  const grammyEventStream = await GrammyEventStream.create(
    mockShutdown,
    createMockBot(),
  );
  controls.resolveClosed();
  await expect(grammyEventStream.closed).rejects.toThrow(
    "grammY event stream ended unexpectedly",
  );
});

test("catch handler logs error with chat and thread", async () => {
  await using _grammyEventStream = await GrammyEventStream.create(
    mockShutdown,
    createMockBot(),
  );
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
    "grammY event stream caught an unhandled error",
    error,
    {
      update: { update_id: 789 },
    },
  );
  expect(mockShutdown.trigger).toHaveBeenCalledOnce();
});

test("catch handler handles missing chat and msg", async () => {
  await using _grammyEventStream = await GrammyEventStream.create(
    mockShutdown,
    createMockBot(),
  );
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
    "grammY event stream caught an unhandled error",
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
    controls.resolveClosed();
    throw error;
  });
  let grammyClosed: Promise<void>;
  {
    await using grammyEventStream = await GrammyEventStream.create(
      mockShutdown,
      createMockBot(),
    );
    grammyClosed = grammyEventStream.closed;
  }
  await expect(grammyClosed).resolves.toBeUndefined();
  expect(logger.fatal).toHaveBeenCalledWith(
    "grammY event stream failed to close",
    error,
  );
  expect(mockShutdown.trigger).toHaveBeenCalled();
});

test("closed does not reject after dispose", async () => {
  let grammyClosed: Promise<void>;
  {
    await using grammyEventStream = await GrammyEventStream.create(
      mockShutdown,
      createMockBot(),
    );
    grammyClosed = grammyEventStream.closed;
  }
  await expect(grammyClosed).resolves.toBeUndefined();
});
