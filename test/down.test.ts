import { runCommand } from "citty";
import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import down from "~/lib/down";

beforeEach(() => {
  consola.mockTypes(() => vi.fn());
});

test("down runs", async () => {
  await expect(runCommand(down, { rawArgs: [] })).resolves.not.toThrow();
});
