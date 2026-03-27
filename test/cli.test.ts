import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import { logger } from "~/lib/logger";
import * as serveModule from "~/lib/serve";

test("prints welcome box", async () => {
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {});
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(stderrSpy).toHaveBeenCalledWith(
    expect.stringContaining("The kitten says hi"),
  );
  stderrSpy.mockRestore();
});

test("runs subcommand with default log level", async () => {
  const defaultMinLevel = logger.settings.minLevel;
  let levelDuringRun: number | undefined;
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {
    levelDuringRun = logger.settings.minLevel;
  });
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(levelDuringRun).toBe(defaultMinLevel);
});
