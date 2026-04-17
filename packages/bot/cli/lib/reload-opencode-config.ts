import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { builtinCommands } from "~/lib/builtin-commands";
import { grammySetCommands } from "~/lib/grammy-set-commands";
import { logger } from "~/lib/logger";

async function listCommandFiles(
  commandsDir: string,
): Promise<{ command: string; description: string }[]> {
  const entries = await readdir(commandsDir).catch(() => []);
  const commands: { command: string; description: string }[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const name = entry.slice(0, -3);
    const content = await readFile(join(commandsDir, entry), "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const descMatch = match?.[1]?.match(/description:\s*(.+)/);
    commands.push({
      command: name,
      description: descMatch?.[1]?.trim() ?? "",
    });
  }
  return commands.sort((a, b) => a.command.localeCompare(b.command));
}

export async function reloadOpencodeConfig(options: {
  commandsDir: string;
  botToken: string;
  groupChat: boolean;
}): Promise<void> {
  logger.info("Reloading Telegram command menu");

  const customCommands = await listCommandFiles(options.commandsDir);

  await grammySetCommands(
    options.botToken,
    [...builtinCommands, ...customCommands],
    options.groupChat,
  );
  logger.info("Refreshed Telegram command menu", {
    total: builtinCommands.length + customCommands.length,
  });
}
