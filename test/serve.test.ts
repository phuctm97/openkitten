import { runCommand } from "citty";
import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import * as createOpenCodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";

let signalHandlers: Map<string, () => void>;

beforeEach(() => {
  signalHandlers = new Map();
  vi.spyOn(process, "once").mockImplementation(((
    event: string,
    handler: () => void,
  ) => {
    signalHandlers.set(event, handler);
    return process;
  }) as never);
});

function mockCreateOpenCode(port = 3000) {
  const exited = new Promise<never>(() => {});
  exited.catch(() => {});
  return vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port,
    exited,
    [Symbol.asyncDispose]: async () => {},
  });
}

test("serve runs and parses port", async () => {
  const start = mockCreateOpenCode();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(signalHandlers.has("SIGINT")).toBe(true));
  signalHandlers.get("SIGINT")?.();
  await expect(run).resolves.not.toThrow();
  expect(start).toHaveBeenCalledOnce();
  expect(consola.log).toHaveBeenCalledWith(
    "opencode is listening on port 3000",
  );
});

test("serve exits on SIGINT", async () => {
  mockCreateOpenCode();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(signalHandlers.has("SIGINT")).toBe(true));
  signalHandlers.get("SIGINT")?.();
  await run;
});

test("serve exits on SIGTERM", async () => {
  mockCreateOpenCode();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(signalHandlers.has("SIGTERM")).toBe(true));
  signalHandlers.get("SIGTERM")?.();
  await run;
});
