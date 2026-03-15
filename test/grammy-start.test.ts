import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import { grammyStart } from "~/lib/grammy-start";

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

test("logs start and ready", async () => {
  await using _grammy = await grammyStart(createMockBot());
  expect(consola.start).toHaveBeenCalledWith("grammY is starting");
  expect(consola.ready).toHaveBeenCalledWith("grammY is ready");
});

test("is async disposable", async () => {
  {
    await using _grammy = await grammyStart(createMockBot());
  }
  expect(mockStop).toHaveBeenCalledOnce();
  expect(consola.info).toHaveBeenCalledWith("grammY is stopped");
});

test("propagates startup error", async () => {
  setupMock({ startError: new Error("polling failed") });
  await expect(grammyStart(createMockBot())).rejects.toThrow("polling failed");
});

test("stopped rejects on unexpected stop", async () => {
  const grammy = await grammyStart(createMockBot());
  controls.resolveStopped();
  await expect(grammy.stopped).rejects.toThrow("grammY stopped unexpectedly");
});

test("catch handler logs error with chat and thread", async () => {
  await using _grammy = await grammyStart(createMockBot());
  expect(mockCatch).toHaveBeenCalledOnce();
  const [handler] = mockCatch.mock.calls[0] as [
    (err: {
      ctx: {
        chat?: { id: number };
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
      msg: { message_thread_id: 456 },
      update: { update_id: 789 },
    },
    error,
  });
  expect(consola.fatal).toHaveBeenCalledWith(
    "grammY caught an unhandled error",
    { error, chatId: 123, threadId: 456, updateId: 789 },
  );
});

test("catch handler handles missing chat and msg", async () => {
  await using _grammy = await grammyStart(createMockBot());
  const [handler] = mockCatch.mock.calls[0] as [
    (err: {
      ctx: {
        chat?: { id: number };
        msg?: { message_thread_id?: number };
        update: { update_id: number };
      };
      error: unknown;
    }) => void,
  ];
  const error = new Error("unexpected");
  handler({ ctx: { update: { update_id: 1 } }, error });
  expect(consola.fatal).toHaveBeenCalledWith(
    "grammY caught an unhandled error",
    { error, chatId: undefined, threadId: undefined, updateId: 1 },
  );
});

test("stopped does not reject after dispose", async () => {
  let grammyStopped: Promise<void>;
  {
    await using grammy = await grammyStart(createMockBot());
    grammyStopped = grammy.stopped;
  }
  await expect(grammyStopped).resolves.toBeUndefined();
});
