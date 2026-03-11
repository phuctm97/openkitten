import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import serve from "~/lib/serve";

test("serve runs", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
});
