import { runCommand } from "citty";
import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import * as createOpenCodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";

const { exitHook } = vi.hoisted(() => ({
  exitHook: vi.fn((cb: () => void) => cb()),
}));

vi.mock("exit-hook", () => ({
  default: exitHook,
}));

beforeEach(() => {
  exitHook.mockClear();
});

function mockCreateOpenCode(port = 3000) {
  return vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port,
    [Symbol.asyncDispose]: async () => {},
  });
}

test("serve runs and parses port", async () => {
  const start = mockCreateOpenCode();
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
  expect(start).toHaveBeenCalledOnce();
  expect(consola.log).toHaveBeenCalledWith(
    "opencode is listening on port 3000",
  );
});

test("serve registers exit hook", async () => {
  mockCreateOpenCode();
  await runCommand(serve, { rawArgs: [] });
  expect(exitHook).toHaveBeenCalledOnce();
});
