import { runCommand } from "citty";
import { expect, test } from "vitest";
import down from "~/lib/down";

test("down runs", async () => {
  await expect(runCommand(down, { rawArgs: [] })).resolves.not.toThrow();
});
