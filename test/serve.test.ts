import { runCommand } from "citty";
import { consola } from "consola";
import { expect, test, vi } from "vitest";
import * as createExitSignalModule from "~/lib/create-exit-signal";
import * as createOpenCodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";

function mockCreateOpenCode(port = 3000) {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  exited.catch(() => {
    // Ignore
  });
  const dispose = vi.fn(async () => {
    resolveExited();
  });
  vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port,
    exited,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockExitSignal() {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  vi.spyOn(createExitSignalModule, "createExitSignal").mockReturnValue({
    exited,
    [Symbol.dispose]() {
      resolveExited();
    },
  });
  return () => resolveExited();
}

test("serve runs and logs port", async () => {
  const dispose = mockCreateOpenCode();
  const triggerExit = mockExitSignal();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(consola.log).toHaveBeenCalledWith(
      "opencode is listening on port 3000",
    ),
  );
  triggerExit();
  await run;
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve disposes on exit", async () => {
  const dispose = mockCreateOpenCode();
  const triggerExit = mockExitSignal();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(createExitSignalModule.createExitSignal).toHaveBeenCalled(),
  );
  triggerExit();
  await run;
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve exits on unexpected opencode exit", async () => {
  const exited = Promise.reject(
    new Error("opencode exited unexpectedly with code 1"),
  );
  exited.catch(() => {
    // Ignore
  });
  vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port: 3000,
    exited,
    [Symbol.asyncDispose]: async () => {},
  });
  mockExitSignal();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly with code 1",
  );
});
