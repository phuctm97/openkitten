import { runCommand } from "citty";
import { expect, test } from "vitest";
import serve from "~/lib/serve";

test("serve runs", async () => {
  await expect(runCommand(serve, { rawArgs: [] })).resolves.not.toThrow();
});
