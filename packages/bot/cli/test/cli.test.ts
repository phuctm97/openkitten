import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { cli } from "~/lib/cli";
import * as downModule from "~/lib/down";
import { logger } from "~/lib/logger";
import * as serveModule from "~/lib/serve";
import * as upModule from "~/lib/up";

test("prints welcome box", async () => {
  vi.spyOn(serveModule.serve, "run").mockImplementation(async () => {});
  await runCommand(cli, { rawArgs: ["serve"] });
  expect(process.stderr.write).toHaveBeenCalledWith(
    expect.stringContaining("The kitten says hi"),
  );
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

test("routes to up subcommand", async () => {
  const run = vi
    .spyOn(upModule.up, "run")
    .mockImplementation(async () => undefined);
  await runCommand(cli, { rawArgs: ["up"] });
  expect(run).toHaveBeenCalled();
});

test("routes to down subcommand", async () => {
  const run = vi
    .spyOn(downModule.down, "run")
    .mockImplementation(async () => undefined);
  await runCommand(cli, { rawArgs: ["down"] });
  expect(run).toHaveBeenCalled();
});
