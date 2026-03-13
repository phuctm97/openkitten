import { inArray } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import { grammyCheckAccessError } from "~/lib/grammy-check-access-error";
import * as schema from "~/lib/schema";
import type { Session } from "~/lib/session";

interface InvalidateSessionsResult {
  reachable: Session[];
  unreachable: Session[];
}

export async function invalidateSessions(
  bot: Bot,
  database: Database,
): Promise<InvalidateSessionsResult> {
  const sessions = await database.query.session.findMany();
  const accessible = await Promise.all(
    sessions.map(async (session) => {
      const threadId = session.threadId || undefined;
      try {
        await bot.api.sendChatAction(session.chatId, "typing", {
          ...(threadId && { message_thread_id: threadId }),
        });
        return true;
      } catch (error) {
        if (grammyCheckAccessError(error)) return false;
        throw error;
      }
    }),
  );
  const reachable = sessions.filter((_, i) => accessible[i]);
  const unreachable = sessions.filter((_, i) => !accessible[i]);
  if (unreachable.length > 0) {
    await database.delete(schema.session).where(
      inArray(
        schema.session.id,
        unreachable.map((s) => s.id),
      ),
    );
  }
  return { reachable, unreachable };
}
