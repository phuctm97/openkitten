import type { Bot } from "grammy";
import invariant from "tiny-invariant";
import type { Database } from "~/lib/database";
import { isUpgradeEnabled } from "~/lib/is-upgrade-enabled";
import { logger } from "~/lib/logger";
import { UpgradeOpenkittenError } from "~/lib/upgrade-openkitten-error";
import type { UpgradeOpenkittenOptions } from "~/lib/upgrade-openkitten-options";
import type { UpgradeOpenkittenResult } from "~/lib/upgrade-openkitten-result";

async function notifySessions(bot: Bot, database: Database): Promise<void> {
  const sessions = database.query.session
    .findMany({ columns: { chatId: true, threadId: true } })
    .sync();
  for (const row of sessions) {
    const sendOptions = {
      ...(row.threadId && { message_thread_id: row.threadId }),
    };
    try {
      await bot.api.sendMessage(
        row.chatId,
        "⏳ Upgrading OpenKitten…",
        sendOptions,
      );
    } catch (error) {
      logger.warn("Failed to send upgrade notification", {
        chatId: row.chatId,
        error,
      });
    }
  }
}

export async function upgradeOpenkitten(
  options: UpgradeOpenkittenOptions,
): Promise<UpgradeOpenkittenResult> {
  if (!isUpgradeEnabled()) {
    throw new UpgradeOpenkittenError(
      "Upgrade is disabled. Set OPENKITTEN_ENABLE_UPGRADE=1 or install via `bun . up` to enable.",
    );
  }

  await notifySessions(options.bot, options.database);

  const entry = process.argv[1];
  invariant(entry, "process.argv[1] must be the entry script path");
  const child = Bun.spawn(
    [process.execPath, entry, "up", "--yes", "--notify-restart"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
    },
  );
  child.unref();

  return { kind: "restarting" };
}
