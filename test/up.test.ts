import { runCommand } from "citty";
import { expect, test } from "vitest";
import { up } from "~/lib/up";

test("runs", async () => {
  await expect(runCommand(up, { rawArgs: [] })).resolves.not.toThrow();
});
