import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import { and, eq } from "drizzle-orm";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";
import pkg from "~/package.json" with { type: "json" };

interface FindOrCreateSessionResult {
  readonly sessionId: string;
  readonly isNew: boolean;
}

export async function findOrCreateSession(
  database: Database,
  opencodeClient: OpencodeClient,
  chatId: number,
  threadId: number | undefined,
): Promise<FindOrCreateSessionResult> {
  const [existing] = await database
    .select({ id: schema.session.id })
    .from(schema.session)
    .where(
      and(
        eq(schema.session.chatId, chatId),
        eq(schema.session.threadId, threadId || 0),
      ),
    );

  if (existing) return { sessionId: existing.id, isNew: false };

  const createResult = await opencodeClient.session.create({});
  if (createResult.error) throw createResult.error;
  const sessionId = createResult.data.id;

  try {
    await database
      .insert(schema.session)
      .values({ id: sessionId, chatId, threadId: threadId || 0 });
    consola.info(`${pkg.name} created a new session`);
    return { sessionId, isNew: true };
  } catch (insertError) {
    // Race condition: another concurrent call created the session first.
    // Clean up the orphaned opencode session before looking up the winner.
    const deleteResult = await opencodeClient.session.delete({
      sessionID: sessionId,
    });
    if (deleteResult.error) throw deleteResult.error;

    const [raced] = await database
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(
        and(
          eq(schema.session.chatId, chatId),
          eq(schema.session.threadId, threadId || 0),
        ),
      );

    // Insert may have failed for a reason other than a unique constraint.
    if (!raced) throw insertError;
    return { sessionId: raced.id, isNew: false };
  }
}
