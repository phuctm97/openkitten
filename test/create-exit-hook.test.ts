import { beforeEach, expect, test, vi } from "vitest";
import { createExitHook } from "~/lib/create-exit-hook";
import { exitEvents } from "~/lib/exit-events";

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

for (const event of exitEvents) {
  test(`createExitHook resolves on ${event}`, async () => {
    const hook = createExitHook();
    handlers.get(event)?.();
    await expect(hook.exited).resolves.toBeUndefined();
  });
}

test("createExitHook resolves on PM2 shutdown message", async () => {
  const hook = createExitHook();
  for (const handler of messageHandlers) handler("shutdown");
  await expect(hook.exited).resolves.toBeUndefined();
});

test("createExitHook ignores non-shutdown messages", async () => {
  const hook = createExitHook();
  for (const handler of messageHandlers) handler("other");
  const result = await Promise.race([
    hook.exited.then(() => "resolved"),
    Promise.resolve("pending"),
  ]);
  expect(result).toBe("pending");
});

test("createExitHook cleans up listeners on signal", () => {
  createExitHook();
  const offBefore = vi.mocked(process.off).mock.calls.length;
  handlers.get("SIGINT")?.();
  // 8 events + 1 message handler
  expect(vi.mocked(process.off).mock.calls.length - offBefore).toBe(9);
});

test("createExitHook resolves exited on dispose", async () => {
  let hook: ReturnType<typeof createExitHook>;
  {
    using _hook = createExitHook();
    hook = _hook;
  }
  await expect(hook.exited).resolves.toBeUndefined();
});
