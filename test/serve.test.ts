import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import serve from "~/lib/serve";
import * as startOpenCodeModule from "~/lib/start-opencode";

function mockStartOpenCode(port = 3000) {
  return vi.spyOn(startOpenCodeModule, "startOpenCode").mockResolvedValue({
    port,
    exited: Promise.resolve(0),
    [Symbol.asyncDispose]: async () => {},
  });
}

test("serve runs and parses port", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const start = mockStartOpenCode();
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
  expect(start).toHaveBeenCalledOnce();
  expect(console.log).toHaveBeenCalledWith(
    "opencode is listening on port 3000",
  );
});
