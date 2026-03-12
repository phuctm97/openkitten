import { beforeEach, expect, test, vi } from "vitest";
import { createExit } from "~/lib/create-exit";
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
  test(`createExit resolves on ${event}`, async () => {
    using hook = createExit();
    handlers.get(event)?.();
    await expect(hook.exited).resolves.toBeUndefined();
  });
}

test("createExit resolves on PM2 shutdown message", async () => {
  using hook = createExit();
  for (const handler of messageHandlers) handler("shutdown");
  await expect(hook.exited).resolves.toBeUndefined();
});

test("createExit ignores non-shutdown messages", async () => {
  using hook = createExit();
  for (const handler of messageHandlers) handler("other");
  const result = await Promise.race([
    hook.exited.then(() => "resolved"),
    Promise.resolve("pending"),
  ]);
  expect(result).toBe("pending");
});

test("createExit cleans up listeners on signal", () => {
  using _hook = createExit();
  const offBefore = vi.mocked(process.off).mock.calls.length;
  handlers.get("SIGINT")?.();
  // 8 events + 1 message handler
  expect(vi.mocked(process.off).mock.calls.length - offBefore).toBe(9);
});

test("createExit resolves exited on dispose", async () => {
  let hook: ReturnType<typeof createExit>;
  {
    using _hook = createExit();
    hook = _hook;
  }
  await expect(hook.exited).resolves.toBeUndefined();
});
