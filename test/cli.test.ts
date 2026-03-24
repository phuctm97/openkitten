import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import { defaultLoggerSettings } from "~/lib/default-logger-settings";
import { logger } from "~/lib/logger";
import * as serveModule from "~/lib/serve";

test("runs subcommand with default log level", async () => {
  let levelDuringRun: number | undefined;
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {
    levelDuringRun = logger.settings.minLevel;
  });
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(levelDuringRun).toBe(defaultLoggerSettings.minLevel);
});
