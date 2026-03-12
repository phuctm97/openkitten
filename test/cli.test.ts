import { runCommand } from "citty";
import { consola, LogLevels } from "consola";
import { expect, test } from "vitest";
import { cli } from "~/lib/cli";

test("cli sets verbose log level with --verbose", async () => {
  await runCommand(cli, { rawArgs: ["--verbose"] }).catch(() => {});
  expect(consola.level).toBe(LogLevels.verbose);
});

test("cli keeps default log level without --verbose", async () => {
  await runCommand(cli, { rawArgs: [] }).catch(() => {});
  expect(consola.level).toBe(LogLevels.info);
});
