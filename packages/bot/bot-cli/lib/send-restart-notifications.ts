import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

export async function sendRestartNotifications(
  bot: Bot,
  database: Database,
): Promise<void> {
  const rows = database.select().from(schema.restartNotification).all();
  if (rows.length === 0) return;
  logger.info("Sending restart notifications", { count: rows.length });
  for (const row of rows) {
    try {
      await bot.api.sendMessage(row.chatId, row.message, {
        ...(row.threadId && { message_thread_id: row.threadId }),
      });
    } catch (error) {
      logger.warn("Failed to send restart notification", {
        chatId: row.chatId,
        error,
      });
    }
    database
      .delete(schema.restartNotification)
      .where(eq(schema.restartNotification.id, row.id))
      .run();
  }
}
