import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import up from "~/lib/up";

test("up runs", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await expect(runCommand(up, { rawArgs: [] })).resolves.not.toThrow();
});
