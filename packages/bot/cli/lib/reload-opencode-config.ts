import { builtinCommands } from "~/lib/builtin-commands";
import { grammySetCommands } from "~/lib/grammy-set-commands";
import { listCommandFiles } from "~/lib/list-command-files";
import { logger } from "~/lib/logger";

export async function reloadOpencodeConfig(options: {
  commandsDir: string;
  botToken: string;
}): Promise<void> {
  logger.info("Reloading Telegram command menu");

  const customCommands = await listCommandFiles(options.commandsDir);

  const builtins = builtinCommands();
  await grammySetCommands(options.botToken, [...builtins, ...customCommands]);
  logger.info("Refreshed Telegram command menu", {
    total: builtins.length + customCommands.length,
  });
}
