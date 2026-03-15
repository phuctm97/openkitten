import { runCommand } from "citty";
import { consola, LogLevels } from "consola";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import * as serveModule from "~/lib/serve";

function mockServe() {
  let levelDuringRun: number | undefined;
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {
    levelDuringRun = consola.level;
  });
  return () => levelDuringRun;
}

test("sets verbose log level during command with --verbose", async () => {
  const getLevel = mockServe();
  await runCommand(cli, { rawArgs: ["serve", "--verbose"] });
  expect(getLevel()).toBe(LogLevels.verbose);
  expect(consola.level).toBe(LogLevels.info);
});

test("keeps default log level without --verbose", async () => {
  const getLevel = mockServe();
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(getLevel()).toBe(LogLevels.info);
  expect(consola.level).toBe(LogLevels.info);
});
