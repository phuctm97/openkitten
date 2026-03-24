import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import { logger } from "~/lib/logger";
import * as serveModule from "~/lib/serve";

test("runs subcommand with default log level", async () => {
  const defaultMinLevel = logger.settings.minLevel;
  let levelDuringRun: number | undefined;
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {
    levelDuringRun = logger.settings.minLevel;
  });
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(levelDuringRun).toBe(defaultMinLevel);
});
