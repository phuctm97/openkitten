import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import { defaultLoggerSettings } from "~/lib/default-logger-settings";
import { logger } from "~/lib/logger";
import * as serveModule from "~/lib/serve";

function mockServe() {
  let levelDuringRun: number | undefined;
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {
    levelDuringRun = logger.settings.minLevel;
  });
  return () => levelDuringRun;
}

test("sets verbose log level during command with --verbose", async () => {
  const getLevel = mockServe();
  await runCommand(cli, { rawArgs: ["serve", "--verbose"] });
  expect(getLevel()).toBe(0);
  expect(logger.settings.minLevel).toBe(defaultLoggerSettings.minLevel);
});

test("keeps default log level without --verbose", async () => {
  const getLevel = mockServe();
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(getLevel()).toBe(defaultLoggerSettings.minLevel);
  expect(logger.settings.minLevel).toBe(defaultLoggerSettings.minLevel);
});
