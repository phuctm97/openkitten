import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import down from "~/lib/down";

test("down runs", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await expect(runCommand(down, { rawArgs: [] })).resolves.not.toThrow();
});
