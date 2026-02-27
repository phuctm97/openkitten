import { beforeEach, expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { Shutdown } from "~/lib/shutdown";

let handlers: Map<string, (signal?: string) => void>;
let messageHandlers: Array<(message: unknown) => void>;

beforeEach(() => {
  handlers = new Map();
  messageHandlers = [];
  vi.spyOn(process, "once").mockImplementation(((
    event: string,
    handler: () => void,
  ) => {
    handlers.set(event, handler);
    return process;
  }) as never);
  vi.spyOn(process, "on").mockImplementation(((
    event: string,
    handler: (message: unknown) => void,
  ) => {
    if (event === "message") messageHandlers.push(handler);
    return process;
  }) as never);
  vi.spyOn(process, "off").mockReturnValue(process);
});

for (const event of Shutdown.events) {
  test(`resolves on ${event}`, async () => {
    using shutdown = Shutdown.create();
    handlers.get(event)?.(event);
    await expect(shutdown.signaled).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith("Shutdown is signaled", {
      event,
    });
  });
}

test("resolves on PM2 shutdown message", async () => {
  using shutdown = Shutdown.create();
  for (const handler of messageHandlers) handler("shutdown");
  await expect(shutdown.signaled).resolves.toBeUndefined();
});

test("ignores non-shutdown messages", async () => {
  using shutdown = Shutdown.create();
  for (const handler of messageHandlers) handler("other");
  const result = await Promise.race([
    shutdown.signaled.then(() => "resolved"),
    Promise.resolve("pending"),
  ]);
  expect(result).toBe("pending");
});

test("cleans up listeners on signal", () => {
  using _shutdown = Shutdown.create();
  const offBefore = vi.mocked(process.off).mock.calls.length;
  handlers.get("SIGINT")?.();
  // 8 events + 1 message handler
  expect(vi.mocked(process.off).mock.calls.length - offBefore).toBe(9);
});

test("logs only once when signal fires before dispose", () => {
  {
    using _shutdown = Shutdown.create();
    handlers.get("SIGINT")?.();
  }
  expect(vi.mocked(logger.info)).toHaveBeenCalledTimes(1);
});

test("resolves signaled on trigger()", async () => {
  using shutdown = Shutdown.create();
  shutdown.trigger();
  await expect(shutdown.signaled).resolves.toBeUndefined();
  expect(logger.info).toHaveBeenCalledWith("Shutdown is signaled", {
    event: undefined,
  });
});

test("trigger() only fires once", () => {
  using shutdown = Shutdown.create();
  shutdown.trigger();
  shutdown.trigger();
  expect(vi.mocked(logger.info)).toHaveBeenCalledTimes(1);
});

test("signal is aborted on trigger", () => {
  using shutdown = Shutdown.create();
  expect(shutdown.signal.aborted).toBe(false);
  shutdown.trigger();
  expect(shutdown.signal.aborted).toBe(true);
});

test("resolves signaled on dispose", async () => {
  let shutdown: Shutdown;
  {
    using _shutdown = Shutdown.create();
    shutdown = _shutdown;
  }
  await expect(shutdown.signaled).resolves.toBeUndefined();
});
