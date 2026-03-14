import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import { shutdownEvents } from "~/lib/shutdown-events";
import { shutdownListen } from "~/lib/shutdown-listen";

let handlers: Map<string, () => void>;
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

for (const event of shutdownEvents) {
  test(`resolves on ${event}`, async () => {
    using shutdown = shutdownListen();
    handlers.get(event)?.();
    await expect(shutdown.signaled).resolves.toBeUndefined();
    expect(consola.info).toHaveBeenCalledWith("Shutdown signal received");
  });
}

test("resolves on PM2 shutdown message", async () => {
  using shutdown = shutdownListen();
  for (const handler of messageHandlers) handler("shutdown");
  await expect(shutdown.signaled).resolves.toBeUndefined();
});

test("ignores non-shutdown messages", async () => {
  using shutdown = shutdownListen();
  for (const handler of messageHandlers) handler("other");
  const result = await Promise.race([
    shutdown.signaled.then(() => "resolved"),
    Promise.resolve("pending"),
  ]);
  expect(result).toBe("pending");
});

test("cleans up listeners on signal", () => {
  using _shutdown = shutdownListen();
  const offBefore = vi.mocked(process.off).mock.calls.length;
  handlers.get("SIGINT")?.();
  // 8 events + 1 message handler
  expect(vi.mocked(process.off).mock.calls.length - offBefore).toBe(9);
});

test("resolves signaled on dispose", async () => {
  let shutdown: ReturnType<typeof shutdownListen>;
  {
    using _shutdown = shutdownListen();
    shutdown = _shutdown;
  }
  await expect(shutdown.signaled).resolves.toBeUndefined();
});
