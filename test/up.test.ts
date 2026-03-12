import { runCommand } from "citty";
import { consola } from "consola";
import { beforeEach, expect, test, vi } from "vitest";
import up from "~/lib/up";

beforeEach(() => {
  consola.mockTypes(() => vi.fn());
});

test("up runs", async () => {
  await expect(runCommand(up, { rawArgs: [] })).resolves.not.toThrow();
});
